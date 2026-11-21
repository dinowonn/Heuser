Heuser College — Programming Career Readiness Program

This repository contains my CRP assignments for Heuser College.

Homework 9 — Tomb of Knowledge

Live Website: https://kaigotbuns.pythonanywhere.com/

About the Project
My project is an interactive digital library called Tomb of knowledge, which uses the Open Library Book Search API to retrieve book information. Visitors will be able to search for books and explore details such as titles, authors, publication years and book covers. The books will be presented as interactive cards, allowing visitors to discover more information about individual titles. This website aims to create an engaging digital library experience rather than simply displaying raw data.

Technologies Used
Python Framework: Flask

Coding Agent: cursor (Grok 4.7)
              Antigravity (Gemini 3.8 Flash : Medium)

Chosen API: Open Library Book Search API

1. API endpoint:
https://openlibrary.org/search.json

2. Data returned:
Book titles
Author names
First publication years
Book cover identifiers
Edition counts

3. API key:
An API key is not required for ordinary book searches.

4. Example request:
https://openlibrary.org/search.json?q=harry+potter

openlibrary.org → The website providing the information.
/search.json → The Book Search API.
?q=harry+potter → Your search query.

Hosting Platform: PythonAnywhere

Project Structure

Homework_9/
├── app.py
├── requirements.txt
├── home/
├── game/
├── portfolio/
├── api/
└── Screenshots/


 Screenshots

Homepage
![Tomb of Knowledge Homepage](CS_CRP/Homework_9/Screenshots/homepage.png)

Game
![Game](CS_CRP/Homework_9/Screenshots/game.png)

Portfolio
![Portfolio](CS_CRP/Homework_9/Screenshots/portfolio.png)

API
![API](CS_CRP/Homework_9/Screenshots/api.png)

Hosting Dashboard
![Hosting Dashboard](CS_CRP/Homework_9/Screenshots/hosting.png)