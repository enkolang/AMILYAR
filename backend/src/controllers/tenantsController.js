import { pool } from "../config/db.js";

export async function listTenants(_request, response, next) {
  try {
    const result = await pool.query("SELECT * FROM tenants ORDER BY name ASC");
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function createTenant(request, response, next) {
  try {
    const { name, lot_no, lease_type, monthly_rate, status } = request.body;
    const result = await pool.query(
      `INSERT INTO tenants(name, lot_no, lease_type, monthly_rate, status)
       VALUES($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, lot_no, lease_type, monthly_rate, status ?? "active"]
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updateTenant(request, response, next) {
  try {
    const { id } = request.params;
    const { name, lot_no, lease_type, monthly_rate, status } = request.body;
    const result = await pool.query(
      `UPDATE tenants
       SET name = $1, lot_no = $2, lease_type = $3, monthly_rate = $4, status = $5
       WHERE id = $6
       RETURNING *`,
      [name, lot_no, lease_type, monthly_rate, status, id]
    );
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function deleteTenant(request, response, next) {
  try {
    const { id } = request.params;
    await pool.query("DELETE FROM tenants WHERE id = $1", [id]);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
}