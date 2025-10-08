# OpenAI Text-to-Speech Demo

A simple Next.js app that provides a small web interface to generate speech from text using OpenAI’s Text-to-Speech (TTS) API.

## Features

- Generate speech from text using OpenAI’s TTS API  
- Multiple voice options  
- Playback generated audio directly in the browser  
- Clean and responsive user interface  
- Styled with Tailwind CSS  

## Tech Stack

- Next.js  
- Tailwind CSS  
- OpenAI API  
- TypeScript  

## Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/openai-tts-demo.git
cd openai-tts-demo

# Install dependencies
npm install

# Set up environment variables
# Create a .env.local file with your OpenAI API key:
# OPENAI_API_KEY=your_api_key_here

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to use the app.

## How It Works

1. User inputs text and selects a voice option.  
2. The app sends a request to the OpenAI TTS API with the text and voice parameters.  
3. The API returns an audio stream or URL of the generated speech.  
4. The app plays back the audio directly in the browser.  

## License

This project is licensed under the MIT License.
