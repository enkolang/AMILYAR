import { pool } from "../config/db.js";

export async function listExpenses(_request, response, next) {
  try {
    const result = await pool.query("SELECT * FROM expenses ORDER BY date DESC");
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createExpense(request, response, next) {
  try {
    const { title, category, amount, date, notes } = request.body;
    const result = await pool.query(
      `INSERT INTO expenses(title, category, amount, date, notes)
       VALUES($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, category, amount, date, notes]
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateExpense(request, response, next) {
  try {
    const { id } = request.params;
    const { title, category, amount, date, notes } = request.body;
    const result = await pool.query(
      `UPDATE expenses
       SET title = $1, category = $2, amount = $3, date = $4, notes = $5
       WHERE id = $6
       RETURNING *`,
      [title, category, amount, date, notes, id]
    );
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteExpense(request, response, next) {
  try {
    const { id } = request.params;
    await pool.query("DELETE FROM expenses WHERE id = $1", [id]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
}