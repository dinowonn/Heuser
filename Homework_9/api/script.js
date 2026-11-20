const form = document.getElementById("search-form");
const queryInput = document.getElementById("query");
const searchButton = document.getElementById("search-button");
const status = document.getElementById("status");
const results = document.getElementById("results");

const waiting = "The catalogue is waiting. Enter a title or an author.";

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = queryInput.value.trim();

  if (!query) {
    setStatus("Enter a title or an author before searching the stacks.");
    results.replaceChildren();
    return;
  }

  searchBooks(query);
});

async function searchBooks(query) {
  const url =
    "https://openlibrary.org/search.json?q=" +
    encodeURIComponent(query) +
    "&limit=12&fields=title,author_name,first_publish_year,cover_i";

  setStatus("Searching the stacks…");
  results.replaceChildren();
  searchButton.disabled = true;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("The archive returned an error.");
    }

    const data = await response.json();
    const books = Array.isArray(data.docs) ? data.docs : [];

    if (books.length === 0) {
      setStatus("No volumes match that inquiry. Try another title or author.");
      return;
    }

    books.forEach((book) => {
      results.appendChild(createCard(book));
    });

    const count = books.length === 1 ? "1 volume" : books.length + " volumes";
    setStatus(count + " brought up from the stacks.");
  } catch (error) {
    setStatus("The archive could not be reached. Check your connection and try again.", true);
  } finally {
    searchButton.disabled = false;
  }
}

function createCard(book) {
  const card = document.createElement("article");
  card.className = "book";

  card.appendChild(createCover(book));

  const title = document.createElement("h2");
  title.textContent = book.title || "Untitled volume";
  card.appendChild(title);

  const authors = document.createElement("p");
  authors.className = "authors";
  authors.textContent = formatAuthors(book.author_name);
  card.appendChild(authors);

  const year = document.createElement("p");
  year.className = "year";
  year.textContent = book.first_publish_year
    ? "First published " + book.first_publish_year
    : "Publication year unrecorded";
  card.appendChild(year);

  return card;
}

function createCover(book) {
  if (!book.cover_i) {
    return missingCover();
  }

  const image = document.createElement("img");
  image.className = "cover";
  image.src = "https://covers.openlibrary.org/b/id/" + book.cover_i + "-M.jpg";
  image.alt = "Cover of " + (book.title || "an untitled volume");
  image.addEventListener("error", () => {
    image.replaceWith(missingCover());
  });
  return image;
}

function missingCover() {
  const fallback = document.createElement("div");
  fallback.className = "cover-missing";
  fallback.setAttribute("role", "img");
  fallback.setAttribute("aria-label", "No cover available");
  fallback.textContent = "No cover kept in the archive";
  return fallback;
}

function formatAuthors(authors) {
  if (!Array.isArray(authors) || authors.length === 0) {
    return "Author unrecorded";
  }

  return authors.join(", ");
}

function setStatus(message, isError) {
  status.textContent = message;
  status.classList.toggle("is-error", Boolean(isError));
}
