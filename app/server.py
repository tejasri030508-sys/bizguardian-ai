import os
import sys
import uuid
import pandas as pd
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

# Ensure project root is in path so we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import get_db_connection, init_db
from app.business_logic import calculate_business_health
from google import genai
from google.genai import types

app = FastAPI(title="BizGuardian AI Backend")

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# FastAPI app setup

@app.on_event("startup")
def on_startup():
    init_db()

@app.post("/api/upload/{dataset_type}")
async def upload_file(dataset_type: str, file: UploadFile = File(...)):
    """Uploads CSV or Excel data and inserts it into SQLite database."""
    if dataset_type not in ["sales", "inventory", "financials"]:
        raise HTTPException(status_code=400, detail="Invalid dataset type. Must be sales, inventory, or financials.")
    
    file_ext = os.path.splitext(file.filename)[1].lower()
    try:
        if file_ext == ".csv":
            df = pd.read_csv(file.file)
        elif file_ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file.file)
        else:
            raise HTTPException(status_code=400, detail="Invalid file type. Only CSV or Excel files are allowed.")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Clear existing data of that type
        cursor.execute(f"DELETE FROM {dataset_type}")
        
        # Insert rows based on type
        if dataset_type == "sales":
            # Expected columns: date, product_name, quantity, price
            required = ["date", "product_name", "quantity", "price"]
            for col in required:
                if col not in df.columns:
                    raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
            
            for _, row in df.iterrows():
                revenue = float(row['quantity']) * float(row['price'])
                cursor.execute(
                    "INSERT INTO sales (date, product_name, quantity, price, total_revenue) VALUES (?, ?, ?, ?, ?)",
                    (str(row['date']), str(row['product_name']), int(row['quantity']), float(row['price']), revenue)
                )
                
        elif dataset_type == "inventory":
            # Expected columns: product_name, stock_level, reorder_point, safety_stock, unit_cost
            required = ["product_name", "stock_level", "reorder_point", "safety_stock", "unit_cost"]
            for col in required:
                if col not in df.columns:
                    raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
                    
            for _, row in df.iterrows():
                cursor.execute(
                    "INSERT OR REPLACE INTO inventory (product_name, stock_level, reorder_point, safety_stock, unit_cost) VALUES (?, ?, ?, ?, ?)",
                    (str(row['product_name']), int(row['stock_level']), int(row['reorder_point']), int(row['safety_stock']), float(row['unit_cost']))
                )
                
        elif dataset_type == "financials":
            # Expected columns: date, category, amount, description
            required = ["date", "category", "amount"]
            for col in required:
                if col not in df.columns:
                    raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
                    
            for _, row in df.iterrows():
                desc = str(row['description']) if 'description' in df.columns else ""
                cursor.execute(
                    "INSERT INTO financials (date, category, amount, description) VALUES (?, ?, ?, ?)",
                    (str(row['date']), str(row['category']), float(row['amount']), desc)
                )
                
        conn.commit()
        conn.close()
        return {"status": "success", "message": f"Successfully parsed and loaded {len(df)} rows into {dataset_type}."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse upload file: {str(e)}")

@app.get("/api/dashboard")
def get_dashboard_data():
    """Compiles dashboard visualization details including sales, inventory and cash flow."""
    health = calculate_business_health()
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Sales timeline (last 30 sales)
        cursor.execute("SELECT date, SUM(total_revenue) as revenue FROM sales GROUP BY date ORDER BY date DESC LIMIT 15")
        sales_timeline = [{"date": r["date"], "revenue": r["revenue"]} for r in cursor.fetchall()]
        sales_timeline.reverse() # show chronological
        
        # Product distribution
        cursor.execute("SELECT product_name, SUM(quantity) as qty, SUM(total_revenue) as revenue FROM sales GROUP BY product_name ORDER BY revenue DESC LIMIT 10")
        product_sales = [{"name": r["product_name"], "quantity": r["qty"], "revenue": r["revenue"]} for r in cursor.fetchall()]
        
        # Low stock items
        cursor.execute("SELECT product_name, stock_level, reorder_point FROM inventory WHERE stock_level <= reorder_point")
        low_stock = [{"product": r["product_name"], "stock": r["stock_level"], "reorder": r["reorder_point"]} for r in cursor.fetchall()]
        
        # Overstocked items
        cursor.execute("SELECT product_name, stock_level, reorder_point FROM inventory WHERE stock_level > (reorder_point * 3)")
        overstock = [{"product": r["product_name"], "stock": r["stock_level"], "reorder": r["reorder_point"]} for r in cursor.fetchall()]
        
        # Financial entries
        cursor.execute("SELECT date, category, amount, description FROM financials ORDER BY date DESC LIMIT 10")
        fin_entries = [{"date": r["date"], "category": r["category"], "amount": r["amount"], "description": r["description"]} for r in cursor.fetchall()]
        
        return {
            "health": health,
            "charts": {
                "sales_timeline": sales_timeline,
                "product_sales": product_sales,
                "low_stock": low_stock,
                "overstock": overstock,
                "fin_entries": fin_entries
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()



@app.post("/api/chat")
async def chat_with_agent(req: ChatRequest):
    """Sends user queries directly to Gemini with local database context."""
    # 1. Fetch current database state as context
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT SUM(amount) as total FROM financials WHERE category = 'expense'")
        total_expenses = cursor.fetchone()["total"] or 0.0
        cursor.execute("SELECT SUM(total_revenue) as total FROM sales")
        total_sales = cursor.fetchone()["total"] or 0.0
        net_profit = total_sales - total_expenses
        
        cursor.execute("SELECT product_name, stock_level, reorder_point FROM inventory WHERE stock_level <= reorder_point")
        low_stock_items = [f"{r['product_name']} (Stock: {r['stock_level']}, Reorder Point: {r['reorder_point']})" for r in cursor.fetchall()]
        
        cursor.execute("SELECT date, SUM(total_revenue) as revenue FROM sales GROUP BY date ORDER BY date DESC LIMIT 5")
        recent_sales = [f"{r['date']}: ${r['revenue']}" for r in cursor.fetchall()]
    except Exception as e:
        total_expenses = 0.0
        total_sales = 0.0
        net_profit = 0.0
        low_stock_items = []
        recent_sales = []
    finally:
        conn.close()
    
    # Build prompt context
    system_instruction = f"""You are BizGuardian AI, a helpful secure business concierge advisor for an MSME.
You are grounded in the following real-time database figures:
- Total Sales Revenue: ${total_sales:.2f}
- Net Cash Flow: ${net_profit:.2f}
- Low Stock Items: {', '.join(low_stock_items) if low_stock_items else 'None'}
- Recent Sales Daily Revenue: {', '.join(recent_sales) if recent_sales else 'No sales recorded yet'}

Use this information to answer any questions the user has about their charts, sales, or inventory. 
Keep your advice practical, actionable, and friendly for a small business owner.
Response format: Markdown."""

    try:
        # Initialize client (will load GEMINI_API_KEY / GOOGLE_API_KEY from environment)
        client = genai.Client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=req.message,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction
            )
        )
        return {
            "session_id": req.session_id or str(uuid.uuid4()),
            "status": "completed",
            "response": response.text or "I'm sorry, I couldn't generate a response."
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

@app.get("/api/audit-logs")
def get_audit_logs():
    """Retrieves security checkpoint log audits."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, timestamp, event_type, severity, details FROM audit_logs ORDER BY timestamp DESC LIMIT 50")
        logs = [dict(row) for row in cursor.fetchall()]
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/reset-db")
def reset_database():
    """Clears all records in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM sales")
        cursor.execute("DELETE FROM inventory")
        cursor.execute("DELETE FROM financials")
        cursor.execute("DELETE FROM audit_logs")
        conn.commit()
        return {"status": "success", "message": "Database wiped successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
