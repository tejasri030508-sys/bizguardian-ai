import sqlite3
import os
from app.config import config

def get_db_connection():
    conn = sqlite3.connect(config.db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Sales Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL NOT NULL,
        total_revenue REAL NOT NULL
    );
    """)
    
    # Inventory Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_name TEXT UNIQUE NOT NULL,
        stock_level INTEGER NOT NULL,
        reorder_point INTEGER NOT NULL,
        safety_stock INTEGER NOT NULL,
        unit_cost REAL NOT NULL
    );
    """)
    
    # Financials Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS financials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT
    );
    """)
    
    # Audit Logs
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        details TEXT NOT NULL
    );
    """)
    
    conn.commit()
    conn.close()

def log_security_event(event_type: str, severity: str, details: str):
    """Log a security event (PII scrubbing or prompt injection detection) to the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO audit_logs (event_type, severity, details) VALUES (?, ?, ?)",
        (event_type, severity, details)
    )
    conn.commit()
    conn.close()
