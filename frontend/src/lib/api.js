import axios from 'axios'

const client = axios.create({ baseURL: '/api/v1' })

export async function submitQuery({ jurisdiction, claim, facts, options = {} }) {
  const { data } = await client.post('/query', { jurisdiction, claim, facts, options })
  return data
}
