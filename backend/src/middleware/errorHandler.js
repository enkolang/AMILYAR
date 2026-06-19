export function errorHandler(error, _request, response, _next) {
  const status = error.statusCode ?? 500;
  response.status(status).json({
    error: {
      message: error.message ?? "Unexpected server error",
      details: error.details ?? null,
    },
  });
}