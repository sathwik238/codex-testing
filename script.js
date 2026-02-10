const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const checkStatusEl = document.getElementById("check-status");
const moveListEl = document.getElementById("move-list");
const capturedWhiteEl = document.getElementById("captured-white");
const capturedBlackEl = document.getElementById("captured-black");
const startPauseBtn = document.getElementById("start-pause");
const resetBtn = document.getElementById("reset");
const whiteTimeEl = document.getElementById("white-time");
const blackTimeEl = document.getElementById("black-time");
const whiteClockCard = document.getElementById("clock-white");
const blackClockCard = document.getElementById("clock-black");

const unicodePieces = {
  w: { king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  b: { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" },
};

const directions = {
  bishop: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  rook: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  queen: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
  king: [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
};

const initialTimeSeconds = 5 * 60;
let clock = { w: initialTimeSeconds, b: initialTimeSeconds };
let activeColor = "w";
let selectedSquare = null;
let legalMoves = [];
let captured = { w: [], b: [] };
let moveHistory = [];
let gameRunning = false;
let gameOver = false;
let timerId = null;

let boardState = createInitialBoard();

function createInitialBoard() {
  return [
    [piece("rook", "b"), piece("knight", "b"), piece("bishop", "b"), piece("queen", "b"), piece("king", "b"), piece("bishop", "b"), piece("knight", "b"), piece("rook", "b")],
    Array.from({ length: 8 }, () => piece("pawn", "b")),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array(8).fill(null),
    Array.from({ length: 8 }, () => piece("pawn", "w")),
    [piece("rook", "w"), piece("knight", "w"), piece("bishop", "w"), piece("queen", "w"), piece("king", "w"), piece("bishop", "w"), piece("knight", "w"), piece("rook", "w")],
  ];
}

function piece(type, color) {
  return { type, color };
}

function toNotation(row, col) {
  return `${String.fromCharCode(97 + col)}${8 - row}`;
}

function formatTime(totalSeconds) {
  const min = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const sec = String(totalSeconds % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function renderBoard() {
  boardEl.innerHTML = "";

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const cell = boardState[row][col];
      const square = document.createElement("button");
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.row = row;
      square.dataset.col = col;

      if (cell) {
        square.textContent = unicodePieces[cell.color][cell.type];
      }

      if (selectedSquare && selectedSquare.row === row && selectedSquare.col === col) {
        square.classList.add("selected");
      }

      const move = legalMoves.find((item) => item.row === row && item.col === col);
      if (move) {
        square.classList.add(move.capture ? "capture" : "legal");
      }

      square.addEventListener("click", handleSquareClick);
      boardEl.appendChild(square);
    }
  }

  updateClocks();
}

function handleSquareClick(event) {
  if (gameOver) return;

  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);
  const clickedPiece = boardState[row][col];

  if (!selectedSquare) {
    if (!clickedPiece || clickedPiece.color !== activeColor) return;
    selectedSquare = { row, col };
    legalMoves = getLegalMoves(boardState, row, col);
    renderBoard();
    return;
  }

  const move = legalMoves.find((item) => item.row === row && item.col === col);
  if (move) {
    applyMove(selectedSquare, { row, col });
    return;
  }

  if (clickedPiece && clickedPiece.color === activeColor) {
    selectedSquare = { row, col };
    legalMoves = getLegalMoves(boardState, row, col);
  } else {
    selectedSquare = null;
    legalMoves = [];
  }

  renderBoard();
}

function applyMove(from, to) {
  if (!gameRunning) {
    gameRunning = true;
    startPauseBtn.textContent = "Pause Clock";
    startTimer();
  }

  const moved = boardState[from.row][from.col];
  const target = boardState[to.row][to.col];
  boardState[to.row][to.col] = moved;
  boardState[from.row][from.col] = null;

  if (moved.type === "pawn" && (to.row === 0 || to.row === 7)) {
    moved.type = "queen";
  }

  if (target) {
    captured[activeColor].push(target);
  }

  moveHistory.push(`${moved.color === "w" ? "White" : "Black"}: ${moved.type} ${toNotation(from.row, from.col)} → ${toNotation(to.row, to.col)}`);

  activeColor = activeColor === "w" ? "b" : "w";
  selectedSquare = null;
  legalMoves = [];

  evaluateGameState();
  renderBoard();
}

function getPseudoMoves(board, row, col, respectCheck = true) {
  const p = board[row][col];
  if (!p) return [];

  const moves = [];

  if (p.type === "pawn") {
    const step = p.color === "w" ? -1 : 1;
    const startRow = p.color === "w" ? 6 : 1;
    const oneAhead = row + step;

    if (inBounds(oneAhead, col) && !board[oneAhead][col]) {
      moves.push({ row: oneAhead, col, capture: false });
      const twoAhead = row + 2 * step;
      if (row === startRow && !board[twoAhead][col]) {
        moves.push({ row: twoAhead, col, capture: false });
      }
    }

    [-1, 1].forEach((offset) => {
      const nextCol = col + offset;
      if (!inBounds(oneAhead, nextCol)) return;
      const pieceAtDiag = board[oneAhead][nextCol];
      if (pieceAtDiag && pieceAtDiag.color !== p.color) {
        moves.push({ row: oneAhead, col: nextCol, capture: true });
      }
    });
  }

  if (p.type === "knight") {
    const jumps = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
    jumps.forEach(([dr, dc]) => {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(nr, nc)) return;
      const target = board[nr][nc];
      if (!target || target.color !== p.color) {
        moves.push({ row: nr, col: nc, capture: Boolean(target) });
      }
    });
  }

  if (["bishop", "rook", "queen"].includes(p.type)) {
    directions[p.type].forEach(([dr, dc]) => {
      let nr = row + dr;
      let nc = col + dc;
      while (inBounds(nr, nc)) {
        const target = board[nr][nc];
        if (!target) {
          moves.push({ row: nr, col: nc, capture: false });
        } else {
          if (target.color !== p.color) {
            moves.push({ row: nr, col: nc, capture: true });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    });
  }

  if (p.type === "king") {
    directions.king.forEach(([dr, dc]) => {
      const nr = row + dr;
      const nc = col + dc;
      if (!inBounds(nr, nc)) return;
      const target = board[nr][nc];
      if (!target || target.color !== p.color) {
        moves.push({ row: nr, col: nc, capture: Boolean(target) });
      }
    });
  }

  if (!respectCheck) return moves;

  return moves.filter((move) => {
    const testBoard = cloneBoard(board);
    testBoard[move.row][move.col] = testBoard[row][col];
    testBoard[row][col] = null;
    return !isKingInCheck(testBoard, p.color);
  });
}

function getLegalMoves(board, row, col) {
  return getPseudoMoves(board, row, col, true);
}

function findKing(board, color) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const p = board[row][col];
      if (p && p.type === "king" && p.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

function isKingInCheck(board, color) {
  const kingPos = findKing(board, color);
  if (!kingPos) return true;

  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const p = board[row][col];
      if (!p || p.color === color) continue;
      const attacks = getPseudoMoves(board, row, col, false);
      if (attacks.some((a) => a.row === kingPos.row && a.col === kingPos.col)) {
        return true;
      }
    }
  }

  return false;
}

function sideHasLegalMove(board, color) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const p = board[row][col];
      if (p && p.color === color) {
        const moves = getLegalMoves(board, row, col);
        if (moves.length) return true;
      }
    }
  }
  return false;
}

function evaluateGameState() {
  const check = isKingInCheck(boardState, activeColor);
  const hasMove = sideHasLegalMove(boardState, activeColor);
  const activeName = activeColor === "w" ? "White" : "Black";

  statusEl.textContent = `${activeName} to move.`;
  checkStatusEl.textContent = check ? `${activeName} is in check.` : "No check.";

  if (!hasMove) {
    gameOver = true;
    gameRunning = false;
    clearInterval(timerId);

    if (check) {
      const winner = activeColor === "w" ? "Black" : "White";
      statusEl.textContent = `Checkmate! ${winner} wins.`;
      checkStatusEl.textContent = "Game over.";
    } else {
      statusEl.textContent = "Stalemate. It's a draw.";
      checkStatusEl.textContent = "Game over.";
    }
  }

  renderMoveHistory();
  renderCaptured();
}

function renderMoveHistory() {
  moveListEl.innerHTML = "";
  moveHistory.forEach((move) => {
    const li = document.createElement("li");
    li.textContent = move;
    moveListEl.appendChild(li);
  });
}

function renderCaptured() {
  capturedWhiteEl.textContent = captured.w.length
    ? captured.w.map((p) => unicodePieces[p.color][p.type]).join(" ")
    : "—";

  capturedBlackEl.textContent = captured.b.length
    ? captured.b.map((p) => unicodePieces[p.color][p.type]).join(" ")
    : "—";
}

function updateClocks() {
  whiteTimeEl.textContent = formatTime(clock.w);
  blackTimeEl.textContent = formatTime(clock.b);

  whiteClockCard.classList.toggle("active", activeColor === "w" && gameRunning && !gameOver);
  blackClockCard.classList.toggle("active", activeColor === "b" && gameRunning && !gameOver);
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    if (!gameRunning || gameOver) return;

    clock[activeColor] -= 1;
    if (clock[activeColor] <= 0) {
      clock[activeColor] = 0;
      gameOver = true;
      gameRunning = false;
      clearInterval(timerId);
      const winner = activeColor === "w" ? "Black" : "White";
      statusEl.textContent = `Time out! ${winner} wins.`;
      checkStatusEl.textContent = "Game over.";
      startPauseBtn.textContent = "Start Clock";
    }

    updateClocks();
  }, 1000);
}

function toggleClock() {
  if (gameOver) return;
  gameRunning = !gameRunning;
  startPauseBtn.textContent = gameRunning ? "Pause Clock" : "Start Clock";
  if (gameRunning) {
    startTimer();
  }
  updateClocks();
}

function resetGame() {
  clearInterval(timerId);
  boardState = createInitialBoard();
  clock = { w: initialTimeSeconds, b: initialTimeSeconds };
  activeColor = "w";
  selectedSquare = null;
  legalMoves = [];
  captured = { w: [], b: [] };
  moveHistory = [];
  gameRunning = false;
  gameOver = false;
  statusEl.textContent = "White to move.";
  checkStatusEl.textContent = "No check.";
  startPauseBtn.textContent = "Start Clock";
  renderMoveHistory();
  renderCaptured();
  renderBoard();
}

startPauseBtn.addEventListener("click", toggleClock);
resetBtn.addEventListener("click", resetGame);

renderCaptured();
renderBoard();
