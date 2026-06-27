import os
import sys

# Ensure project root is in path so we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from mcp.server.fastmcp import FastMCP
from app.database import get_db_connection

mcp = FastMCP("BizGuardian")

@mcp.tool()
def query_sales_trends(days: int = 30) -> str:
    """Queries sales records for the last N days to analyze top-performing products and sales volume.
    
    Args:
        days: The number of recent days of sales history to retrieve.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Retrieve all recent sales
        cursor.execute(
            "SELECT date, product_name, quantity, price, total_revenue FROM sales ORDER BY date DESC LIMIT 100"
        )
        rows = cursor.fetchall()
        if not rows:
            return "No sales records found in the database. Please upload sales data."
        
        # Convert to list of dicts for simple text presentation
        results = []
        for r in rows:
            results.append(
                f"- Date: {r['date']}, Product: {r['product_name']}, Qty: {r['quantity']}, Total: ${r['total_revenue']:.2f}"
            )
        return "\n".join(results)
    except Exception as e:
        return f"Error querying sales trends: {str(e)}"
    finally:
        conn.close()

@mcp.tool()
def query_inventory_status() -> str:
    """Queries the current stock level, unit cost, safety stock, and reorder point of all inventory items."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT product_name, stock_level, reorder_point, safety_stock, unit_cost FROM inventory"
        )
        rows = cursor.fetchall()
        if not rows:
            return "No inventory records found in the database. Please upload inventory data."
        
        results = []
        for r in rows:
            status = "OK"
            if r['stock_level'] <= r['reorder_point']:
                status = "CRITICAL SHORTAGE RISK"
            elif r['stock_level'] > (r['reorder_point'] * 3):
                status = "OVERSTOCK RISK"
            results.append(
                f"- Product: {r['product_name']}, Stock: {r['stock_level']} (Reorder Point: {r['reorder_point']}, Safety: {r['safety_stock']}), Cost: ${r['unit_cost']:.2f} [{status}]"
            )
        return "\n".join(results)
    except Exception as e:
        return f"Error querying inventory: {str(e)}"
    finally:
        conn.close()

@mcp.tool()
def query_financial_summary() -> str:
    """Queries and summarizes business financials including expenses and revenue categories to help calculate cash flows."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT category, SUM(amount) as total FROM financials GROUP BY category"
        )
        rows = cursor.fetchall()
        
        # Check sales total too
        cursor.execute("SELECT SUM(total_revenue) as total_sales FROM sales")
        sales_row = cursor.fetchone()
        total_sales = sales_row['total_sales'] or 0.0
        
        if not rows and total_sales == 0.0:
            return "No financial records found in the database. Please upload financial and sales data."
        
        results = [f"- Category: Sales Revenue (derived from sales), Total: ${total_sales:.2f}"]
        total_expenses = 0.0
        
        for r in rows:
            results.append(f"- Category: {r['category']}, Total: ${r['total']:.2f}")
            if r['category'].lower() in ["expense", "operating expense", "marketing", "tax", "payroll"]:
                total_expenses += r['total']
                
        net_profit = total_sales - total_expenses
        results.append(f"\nNet Cash Position (Sales - Expenses): ${net_profit:.2f}")
        return "\n".join(results)
    except Exception as e:
        return f"Error querying financials: {str(e)}"
    finally:
        conn.close()

if __name__ == "__main__":
    mcp.run()
