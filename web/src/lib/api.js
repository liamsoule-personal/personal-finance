const handle = async (res) => {
  if (res.ok) return res.status === 204 ? null : res.json()
  const err = await res.json().catch(() => ({ detail: res.statusText }))
  throw err
}

export const api = {
  get: (path) => fetch(`/api${path}`).then(handle),
  post: (path, body) => fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(handle),
  patch: (path, body) => fetch(`/api${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(handle),
  delete: (path) => fetch(`/api${path}`, { method: 'DELETE' }).then(handle),
}
