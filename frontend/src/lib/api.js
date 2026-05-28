import axios from 'axios'

const client = axios.create({ baseURL: '/api/v1' })

export async function submitQuery({ jurisdiction, claim, facts, procedural_posture, options = {} }) {
  const body = { jurisdiction, claim, facts, options }
  if (procedural_posture) body.procedural_posture = procedural_posture
  const { data } = await client.post('/query', body)
  return data
}
