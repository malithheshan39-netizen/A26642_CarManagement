# Car Management Application

## 1. Student and project
- Student ID: A26642
- Name: Malith Heshan Hettiarachchi
- Project title: Car Management Application
- Description: Web application for browsing and managing cars, searching by brand, model and description, and viewing related owner information.

## 2. Technology stack
- Database: MongoDB Atlas
- Backend: Node.js + Express
- Client: HTML + CSS + JavaScript
- API testing tool: Thunder Client (and curl)

## 3. Data model
**Collection A: cars**
- car_id, brand, model, year, price, owner_id, description

**Collection B: owners**
- owner_id, name, country, phone

**Relationship field:** `cars.owner_id` -> `owners.owner_id`

## 4. Text index
- Collection with the text index: `cars`
- Indexed fields: `brand`, `model`, `description`
- Index command: `db.cars.createIndex({ brand: "text", model: "text", description: "text" })`
- Text search query: `db.cars.find({ $text: { $search: "electric" } })`
- How the API uses it: `GET /cars/search?query=...` passes the query value to `$text` / `$search` and sorts the results by `textScore`.

## 5. API endpoints
| Method | URL | Description |
|---|---|---|
| GET | /cars | Get all cars |
| GET | /cars/:id | Get one car by car_id |
| GET | /owners/:id | Get one owner by owner_id |
| GET | /cars/search?query=... | Search cars using the text index |
| POST | /cars | Add a new car |
| PUT | /cars/:id | Edit a car |
| DELETE | /cars/:id | Delete a car |

## 6. How to run
1. Import `database/cars.json` and `database/owners.json` into MongoDB Atlas (database `cars_project`, collections `cars` and `owners`).
2. Create the text index using the command in `database/indexes.txt`.
3. `cd backend`
4. Copy `.env.example` to `.env` and set `MONGODB_URI`.
5. `npm install`
6. `node server.js`
7. Open `client/index.html` in the browser.