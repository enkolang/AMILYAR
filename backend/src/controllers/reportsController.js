import { pool } from "../config/db.js";

export async function getDashboardSummary(_request, response, next) {
  try {
    const [collections, outstanding, expenses] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'paid'"),
      pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status <> 'paid'"),
      pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses"),
    ]);

    response.json({
      totalCollections: Number(collections.rows[0].total),
      outstandingBalance: Number(outstanding.rows[0].total),
      totalExpenses: Number(expenses.rows[0].total),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMonthlyCollections(_request, response, next) {
  try {
    const result = await pool.query(
      `SELECT month,
          SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid,
          SUM(CASE WHEN status <> 'paid' THEN amount ELSE 0 END) AS outstanding
       FROM payments
       GROUP BY month
       ORDER BY month`
    );
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
}