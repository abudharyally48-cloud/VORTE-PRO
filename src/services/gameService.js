// src/services/gameService.js

class GameService {
  constructor() {
    this.ticTacToe = {};
    this.hangman = {};
    this.quizzes = {};
    this.setupCleanup();
  }

  setupCleanup() {
    setInterval(() => {
      const now = Date.now();
      const oneHour = 3600000;

      Object.keys(this.ticTacToe).forEach(key => {
        if (this.ticTacToe[key].createdAt && (now - this.ticTacToe[key].createdAt) > oneHour) {
          delete this.ticTacToe[key];
        }
      });

      Object.keys(this.hangman).forEach(key => {
        if (this.hangman[key].createdAt && (now - this.hangman[key].createdAt) > oneHour) {
          delete this.hangman[key];
        }
      });

      Object.keys(this.quizzes).forEach(key => {
        if (this.quizzes[key].createdAt && (now - this.quizzes[key].createdAt) > oneHour) {
          delete this.quizzes[key];
        }
      });
    }, 300000); // Every 5 minutes
  }

  // Tic Tac Toe
  getTTT(chat) { return this.ticTacToe[chat]; }
  setTTT(chat, data) { this.ticTacToe[chat] = data; }
  deleteTTT(chat) { delete this.ticTacToe[chat]; }

  // Hangman
  getHangman(chat) { return this.hangman[chat]; }
  setHangman(chat, data) { this.hangman[chat] = data; }
  deleteHangman(chat) { delete this.hangman[chat]; }

  // Quizzes
  getQuiz(chat) { return this.quizzes[chat]; }
  setQuiz(chat, data) { this.quizzes[chat] = data; }
  deleteQuiz(chat) { delete this.quizzes[chat]; }
}

module.exports = new GameService();
