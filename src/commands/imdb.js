// src/commands/imdb.js
const omdb = require("../services/omdb");
const config = require("../config/config");

module.exports = {
  name: 'imdb',
  description: 'Search for movie details',
  async execute(sock, m, args) {
    const chat = m.key.remoteJid;
    const title = args.join(" ");

    if (!omdb.isAvailable()) {
      return sock.sendMessage(chat, { text: config.missingKeyMessage });
    }

    if (!title) return sock.sendMessage(chat, { text: "🎬 Please provide a movie title." });

    const movie = await omdb.getMovieDetails(title);
    if (!movie || movie.Response === "False") {
      return sock.sendMessage(chat, { text: "❌ Movie not found." });
    }

    const info = `🎬 *${movie.Title}* (${movie.Year})\n\n⭐ Rating: ${movie.imdbRating}\n📅 Released: ${movie.Released}\n🎭 Genre: ${movie.Genre}\n👨‍💼 Director: ${movie.Director}\n📝 Plot: ${movie.Plot}`;
    
    await sock.sendMessage(chat, { 
      image: { url: movie.Poster },
      caption: info 
    });
  }
};
