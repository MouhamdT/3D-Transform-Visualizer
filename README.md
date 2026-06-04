# 3D Transform Visualizer & Challenge Mode

This project is an interactive Computer Graphics visualizer for Assignment 2.
It demonstrates how a 3D wireframe object changes using translation, rotation, and scaling.

## App Link

https://ai.studio/apps/7bf7b285-6b01-4da0-a3ec-87f9d91a4af0

## What the App Does

The app shows a simple 3D wireframe model and helps explain the difference between **local transformations** and **world transformations**.

Local transformations affect the object relative to its own center and direction.
World transformations affect the object relative to the fixed world coordinate system.

## Main Features

* 3D wireframe object visualization
* Local and world transformation controls
* Translation, rotation, and scaling
* Object center / pivot point
* Bounding box and normalization idea
* Challenge mode where the user tries to match a target 3D pose

## Connection to Assignment 2

This app is related to Assignment 2 because it visualizes important computer graphics concepts such as:

* OBJ-style 3D models
* Vertices and faces
* Wireframe rendering
* Bounding-box normalization
* Local transformations
* World transformations

## Run Locally

Prerequisites: Node.js

Install dependencies:

```bash
npm install
```

Create a `.env.local` file and add your Gemini API key:

```bash
GEMINI_API_KEY=your_api_key_here
```

Run the app:

```bash
npm run dev
```

## Author

Mouhammad Tawil
