# AI Full-Stack IDE

This project contains both a frontend and a backend.

## Frontend

The `frontend` directory contains a standard React application powered by Vite.

## Backend

The `backend` directory contains a Node.js server using Express.

## Running Locally

To run the project locally, you would typically install dependencies and run the development servers in separate terminals.

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Running with Docker

This project is containerized using Docker and Docker Compose for easy setup and deployment.

1.  **Prerequisites:**
    *   [Docker](https://www.docker.com/get-started) installed on your machine.
    *   Docker Compose (usually included with Docker Desktop).

2.  **Build and Run:**
    From the root directory of the project, run the following command:
    ```bash
    docker-compose up --build
    ```
    This will build the images for both the frontend and backend services and start the containers.

3.  **Accessing the services:**
    *   **Frontend:** Open your browser and navigate to [http://localhost:3000](http://localhost:3000)
    *   **Backend:** The backend API will be running at [http://localhost:3001](http://localhost:3001)

4.  **Stopping the services:**
    To stop the running containers, press `Ctrl + C` in the terminal where docker-compose is running, or run the following command from another terminal:
    ```bash
    docker-compose down
    ```