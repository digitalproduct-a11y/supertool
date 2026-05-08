require('dotenv').config()
const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

app.get('/api/cloudinary/badminton-images', async (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  console.log('Fetching badminton images from Cloudinary...')
  console.log('Cloud Name:', cloudName)

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('Missing Cloudinary credentials')
    return res.status(500).json({ error: 'Missing Cloudinary credentials' })
  }

  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/search`

    console.log('Calling Cloudinary Search API...')
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expression: 'asset_folder="Engagement Photos/Badminton"',
        max_results: 500,
        sort_by: [{ created_at: 'desc' }]
      })
    })

    console.log('Response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('Cloudinary API error:', response.status)
      console.error('Error response:', error)
      throw new Error(`Cloudinary API failed: ${response.status}`)
    }

    const data = await response.json()

    console.log('Successfully fetched', (data.resources || []).length, 'badminton images')
    res.json(data)
  } catch (error) {
    console.error('Error fetching Cloudinary images:', error.message)
    res.status(500).json({ error: 'Failed to fetch images', details: error.message })
  }
})

// Proxy: Badminton Fetch Ideas
app.post('/api/badminton/fetch-ideas', async (req, res) => {
  try {
    const response = await fetch('https://astroproduct.app.n8n.cloud/webhook-test/badminton-news/fetch-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Error calling badminton fetch-ideas webhook:', error.message)
    res.status(500).json({ error: 'Failed to fetch ideas', details: error.message })
  }
})

// Proxy: Badminton Generate Posts
app.post('/api/badminton/generate-posts', async (req, res) => {
  try {
    const response = await fetch('https://astroproduct.app.n8n.cloud/webhook-test/badminton-news/generate-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })

    const data = await response.json()
    res.status(response.status).json(data)
  } catch (error) {
    console.error('Error calling badminton generate-posts webhook:', error.message)
    res.status(500).json({ error: 'Failed to generate posts', details: error.message })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
