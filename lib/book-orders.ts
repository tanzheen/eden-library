export async function requestBorrow(bookId: number) {
  const response = await fetch("/api/request-borrow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookId }),
  });

  const result = await response.json();

  return {
    ok: response.ok,
    error: response.ok ? null : result.error || "Failed to request borrow",
    data: result,
  };
}

export async function approveOrder(orderId: number) {
  const response = await fetch("/api/approve-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });

  const result = await response.json();

  return {
    ok: response.ok,
    error: response.ok ? null : result.error || "Failed to approve request",
    data: result,
  };
}

export async function returnOrder(orderId: number) {
  const response = await fetch("/api/return-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });

  const result = await response.json();

  return {
    ok: response.ok,
    error: response.ok ? null : result.error || "Failed to return book",
    data: result,
  };
}
