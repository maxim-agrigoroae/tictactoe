const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const getRandomInRange = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const calculateWinner = (squares) => {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }

  return null;
}

const whoseX = (id_1, id_2) => {
  const _t = [id_1, id_2];

  return _t[getRandomInRange(0, 1)];
}

const handleClientCorrupt = (clientId, queue) => {
  // return
  return queue.filter(id => clientId !== id);
}

app.get('/', (req, res) => {
  res.send({ response: "I am alive" }).status(200);
});

const e = {
  connection: 'connection',
  search: 'search',
  yourOpponent: 'your_opponent',
  turn: 'turn',
  haveWinner: 'have_winner',
  disconnect: 'disconnect',
  error: 'error'
};

let queue = [];
let activeGames = {};

// @todo: active games..
// @todo: inform about corrupted game, discont.. errors etc.

io.on(e.connection, (socket) => {
  socket.on(e.search, ({ clientId }) => {
    if (queue.length) { // not empty
      const opponentId = queue[0]; // gets first opponent from queue..
      queue = queue.slice(1); // update queue..

      const starts = whoseX(clientId, opponentId);

      gameId = `${clientId}${opponentId}${Date.now()}` // generates an unique gameid..

      activeGames[gameId] = {

      }

      socket
        // .to(clientId) // will be visible that event for all connected sockets.
        .emit(e.yourOpponent, {
          gameId,
          opponent: opponentId,
          xIsNext: starts
        });

      socket.to(opponentId)
        .emit(e.yourOpponent, {
          gameId,
          opponent: clientId,
          xIsNext: starts
        });

    } else {
      queue.push(clientId);
    }
  });

  // socket.on(e.newGame, ())

  socket.on(e.turn, (state) => {
    const { history, gameData } = state;
    const current = history[history.length - 1];
    const squares = current.squares.slice();

    const winner = calculateWinner(squares);
    if (winner) {
      // rm from active games
      socket.to(gameData.opponent).emit(e.haveWinner, {
        ...state,
        winner
      });
      socket.emit(e.haveWinner, {
        ...state,
        winner
      })
    } else {
      socket.to(gameData.opponent).emit(e.turn, state); // will emit to all sockets..
    }
  });

  socket.on(e.disconnect, () => {
    queue = handleClientCorrupt(socket.id, queue);
  })

  socket.on(e.error, () => {
    queue = handleClientCorrupt(socket.id, queue);
  })
});

const port = 5000
http.listen(port, () => {
  console.log(`listening on *:${port}`);
});
