import React from 'react';
import ReactDOM from 'react-dom';
import io from 'socket.io-client';

import funnyNames from './funnyNames.json';

import './index.css';

function getRandomInRange(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function Square(props) {
  return (
    <button className="square" onClick={props.onClick}>
      {props.value}
    </button>
  );
}

function Searching(props) {
  return (
    <div className="canvas">
      Searching Opponent ...
    </div>
  );
}

function Loader(props) {
  return (
    <div className="canvas">
      Loading ...
    </div>
  );
}

class Lobby extends React.Component {
  constructor(props) {
    super(props);

    const name = funnyNames[getRandomInRange(0, funnyNames.length - 1)];

    this.state = {
      timer: 3,
      opponentName: name,
      startGame: false,
      gameData: props.gameData,
      socket: props.socket,
    }
  }

  componentDidMount() {
    const intervalId = setInterval(() => {
      const { timer } = this.state;

      if (timer === 1) {
        clearInterval(intervalId);
        this.setState({ startGame: true });
      } else {
        this.setState({
          timer: timer - 1
        });
      }
    }, 1000);
  }

  render() {
    const { timer, opponentName, startGame, gameData } = this.state;

    if (startGame) {
      return (
        <Game
          gameData={gameData}
          socket={this.state.socket}
        />
      );
    }

    return (
      <div className="canvas">
        Your opponent "{opponentName}". Game starting in {timer}
      </div>
    );
  }
}

class Board extends React.Component {
  renderSquare(i) {
    return (
      <Square
        value={this.props.squares[i]}
        onClick={() => this.props.onClick(i)}
      />
    );
  }

  render() {
    return (
      <div className="board">
        <div className="board-row">
          {this.renderSquare(0)}
          {this.renderSquare(1)}
          {this.renderSquare(2)}
        </div>
        <div className="board-row">
          {this.renderSquare(3)}
          {this.renderSquare(4)}
          {this.renderSquare(5)}
        </div>
        <div className="board-row">
          {this.renderSquare(6)}
          {this.renderSquare(7)}
          {this.renderSquare(8)}
        </div>
      </div>
    );
  }
}

class Game extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      history: [
        {
          squares: Array(9).fill(null)
        }
      ],
      stepNumber: 0,
      socket: props.socket,
      gameData: props.gameData,
      playerIs: props.socket.id === props.gameData.xIsNext ? 'X' : 'O',
      xIsNext: true,
      winner: null,
      showMenu: false,
      playAgain: false,
    };
  }

  whoseTurn() {
    const { xIsNext } = this.state;

    return xIsNext ? "X" : "O";
  }

  isPlayerTurn() {
    const { playerIs } = this.state;

    return playerIs === this.whoseTurn();
  }

  componentDidMount() {
    const { socket } = this.state;

    socket.on('turn', (state) => {
      this.setState({
        history: state.history,
        stepNumber: state.stepNumber,
        xIsNext: state.xIsNext,
      });
    });

    socket.on('have_winner', (state) => {
      this.setState({
        history: state.history,
        stepNumber: state.stepNumber,
        xIsNext: state.xIsNext,
        winner: state.winner
      });
    });

    socket.on('opponent_quit', () => {
      this.setState({ corruptedGame: true });
    })
  }

  handleClick(i) {
    // todo game is done check
    if (!this.isPlayerTurn() || this.state.winner) {
      return;
    }

    const { socket, playerIs } = this.state;

    const history = this.state.history.slice(0, this.state.stepNumber + 1);
    const current = history[history.length - 1];
    const squares = current.squares.slice();

    if (squares[i]) {
      return;
    }

    squares[i] = playerIs;

    const state = {
      history: history.concat({
        squares
      }),
      stepNumber: history.length,
      xIsNext: !this.state.xIsNext,
      gameData: this.state.gameData
    }

    socket.emit('turn', state);

    this.setState(state);
  }

  playAgain() {
    this.setState({ playAgain: true });
  }

  goToMenu() {
    this.setState({ showMenu: true });
  }

  render() {
    if (this.state.showMenu) {
      return (<Menu />);
    }

    if (this.state.playAgain) {
      return (<Menu inSearch={true} />);
    }

    const history = this.state.history;
    const current = history[this.state.stepNumber];
    const winner = this.state.winner;
    const corruptedGame = this.state.corruptedGame;

    let status;
    if (winner) {
      status = "Winner: " + winner;
    } else {
      status = `You are "${this.state.playerIs}": turn "${this.whoseTurn()}"`;
    }

    if (winner || corruptedGame || (current.squares.filter(e => e)).length === 9) {
      if (!winner) {
        status = "Draw!";
      }

      if (corruptedGame) {
        status = 'Your opponent exit!'
      }

      return (
        <div className="canvas">
          <div>{status}</div>
          <ul className="menu">
            <li>
              <button onClick={() => this.playAgain()}>Play Again</button>
            </li>
            <li>
              <button onClick={() => this.goToMenu()}>Go to menu</button>
            </li>
          </ul>
        </div>
      );
    }

    return (
      <div className="canvas">
        <div className="game">
          <div className="game-board">
            <Board
              squares={current.squares}
              onClick={i => this.handleClick(i)}
            />
          </div>
          <div className="game-info">
            <div>{status}</div>
          </div>
        </div>
      </div>
    );
  }
}

class Menu extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: true,
      inSearch: props.inSearch || false,
      endpoint: process.env.REACT_APP_API_BASENAME,
      socket: null,
      opponent: null,
      gameData: {
        opponent: null,
        xIsNext: true
      },
    }
  }

  componentDidMount() {
    const { endpoint, inSearch } = this.state;
    const socket = io(endpoint);
    socket.on('connect', () => {
      this.setState({
        socket,
        isLoading: false
      });

      if (inSearch) {
        this.searchOpponent();
      }
    });
  }

  searchOpponent() {
    this.setState({
      inSearch: true
    });

    const { socket } = this.state;

    socket.emit('search', { clientId: socket.id });

    socket.on('your_opponent', (gameData) => {
      this.setState({ gameData });
    });
  }

  render() {
    const { isLoading, gameData, inSearch } = this.state;

    if (isLoading) {
      return (
        <Loader />
      )
    }

    if (gameData.opponent) {
      return (
        <Lobby
          gameData={this.state.gameData}
          socket={this.state.socket}
        />
      );
    }

    if (inSearch) {
      return (
        <Searching />
      );
    }

    return (
      <div className="canvas">
        <ul className="menu">
          <li>
            <button onClick={() => this.searchOpponent()}>Play</button>
          </li>
        </ul>
      </div>
    );
  }
}


// ========================================

ReactDOM.render(<Menu />, document.getElementById("root"));
