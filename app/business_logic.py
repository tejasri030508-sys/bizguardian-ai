from app.database import get_db_connection

def calculate_business_health() -> dict:
    """Calculates dashboard metrics and a holistic Business Health Score."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Defaults
    score = 100
    deductions = []
    
    # 1. Check stockout risks
    cursor.execute("SELECT COUNT(*) as count FROM inventory WHERE stock_level <= reorder_point")
    shortage_count = cursor.fetchone()['count'] or 0
    if shortage_count > 0:
        deduction = min(shortage_count * 5, 25)
        score -= deduction
        deductions.append(f"Stock shortage risks: -{deduction} points ({shortage_count} products below reorder point)")
        
    # 2. Check overstock issues
    cursor.execute("SELECT COUNT(*) as count FROM inventory WHERE stock_level > (reorder_point * 3)")
    overstock_count = cursor.fetchone()['count'] or 0
    if overstock_count > 0:
        deduction = min(overstock_count * 2, 10)
        score -= deduction
        deductions.append(f"Overstock inventory holding cost: -{deduction} points ({overstock_count} products overstocked)")
        
    # 3. Check financials
    cursor.execute("SELECT category, SUM(amount) as total FROM financials GROUP BY category")
    fin_rows = cursor.fetchall()
    
    cursor.execute("SELECT SUM(total_revenue) as total_sales FROM sales")
    sales_row = cursor.fetchone()
    total_sales = sales_row['total_sales'] or 0.0
    
    total_expenses = 0.0
    for r in fin_rows:
        if r['category'].lower() in ["expense", "operating expense", "marketing", "tax", "payroll"]:
            total_expenses += r['total']
            
    net_profit = total_sales - total_expenses
    
    if total_sales > 0:
        profit_margin = (net_profit / total_sales) * 100
        if profit_margin < 10:
            score -= 15
            deductions.append("Low profit margin (< 10%): -15 points")
        elif profit_margin < 0:
            score -= 25
            deductions.append("Negative cash flow / Operating loss: -25 points")
    else:
        score -= 30
        deductions.append("No sales revenue recorded: -30 points")
        
    # Final clamping
    score = max(score, 10)
    
    conn.close()
    
    return {
        "health_score": score,
        "deductions": deductions,
        "total_sales": total_sales,
        "total_expenses": total_expenses,
        "net_profit": net_profit,
        "shortage_count": shortage_count,
        "overstock_count": overstock_count
    }
