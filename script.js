const tabs = document.querySelectorAll("[data-panel-target]");
const panels = document.querySelectorAll(".panel");

const activatePanel = (targetId) => {
  panels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === targetId);
  });
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panelTarget === targetId);
  });
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activatePanel(tab.dataset.panelTarget));
});

const calcInput = document.getElementById("calc-input");
const calcHistory = document.getElementById("calc-history");
const calcButtons = document.querySelectorAll(".calc-buttons button");

const updateHistory = (text) => {
  calcHistory.textContent = text;
};

const sanitizeExpression = (expression) =>
  expression.replace(/[^0-9+\-*/().%]/g, "");

const evaluateExpression = () => {
  const sanitized = sanitizeExpression(calcInput.value);
  if (!sanitized.trim()) {
    updateHistory("Enter an expression to evaluate.");
    return;
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${sanitized})`)();
    updateHistory(`${sanitized} = ${result}`);
    calcInput.value = result;
  } catch (error) {
    updateHistory("That expression did not work. Try again.");
  }
};

calcButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const { action, value } = button.dataset;
    if (action === "clear") {
      calcInput.value = "";
      updateHistory("Cleared.");
      return;
    }
    if (action === "delete") {
      calcInput.value = calcInput.value.slice(0, -1);
      return;
    }
    if (action === "equals") {
      evaluateExpression();
      return;
    }
    if (value) {
      calcInput.value += value;
    }
  });
});

calcInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    evaluateExpression();
  }
});

const tttBoard = document.getElementById("ttt-board");
const tttStatus = document.getElementById("ttt-status");
const tttReset = document.getElementById("ttt-reset");
const tttSwap = document.getElementById("ttt-swap");
const tttCells = Array.from(document.querySelectorAll(".cell"));

const winningCombos = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

let tttCurrent = "X";
let tttLocked = false;

const resetBoard = () => {
  tttCells.forEach((cell) => {
    cell.textContent = "";
    cell.classList.remove("winner");
  });
  tttLocked = false;
  tttStatus.textContent = `Player ${tttCurrent}'s turn`;
};

const checkWinner = () => {
  for (const combo of winningCombos) {
    const [a, b, c] = combo;
    if (
      tttCells[a].textContent &&
      tttCells[a].textContent === tttCells[b].textContent &&
      tttCells[a].textContent === tttCells[c].textContent
    ) {
      combo.forEach((index) => tttCells[index].classList.add("winner"));
      tttStatus.textContent = `Player ${tttCells[a].textContent} wins!`;
      tttLocked = true;
      return true;
    }
  }
  return false;
};

const checkDraw = () =>
  tttCells.every((cell) => cell.textContent.trim() !== "");

const handleMove = (cell) => {
  if (cell.textContent || tttLocked) return;
  cell.textContent = tttCurrent;
  if (checkWinner()) return;
  if (checkDraw()) {
    tttStatus.textContent = "It's a draw!";
    tttLocked = true;
    return;
  }
  tttCurrent = tttCurrent === "X" ? "O" : "X";
  tttStatus.textContent = `Player ${tttCurrent}'s turn`;
};

tttBoard.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  handleMove(cell);
});

tttReset.addEventListener("click", () => {
  tttCurrent = "X";
  resetBoard();
});

tttSwap.addEventListener("click", () => {
  tttCurrent = tttCurrent === "X" ? "O" : "X";
  resetBoard();
});

const colorA = document.getElementById("color-a");
const colorB = document.getElementById("color-b");
const angle = document.getElementById("angle");
const angleValue = document.getElementById("angle-value");
const gradientPreview = document.getElementById("gradient-preview");
const gradientLabel = document.getElementById("gradient-label");
const copyGradient = document.getElementById("copy-gradient");
const copyStatus = document.getElementById("copy-status");

const updateGradient = () => {
  const gradient = `linear-gradient(${angle.value}deg, ${colorA.value}, ${colorB.value})`;
  gradientPreview.style.background = gradient;
  gradientLabel.textContent = gradient;
  angleValue.textContent = angle.value;
};

const copyGradientToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(gradientLabel.textContent);
    copyStatus.textContent = "Copied! Paste it into your CSS.";
  } catch (error) {
    copyStatus.textContent = "Unable to copy. Select the text above instead.";
  }
};

[colorA, colorB, angle].forEach((input) =>
  input.addEventListener("input", updateGradient)
);

copyGradient.addEventListener("click", copyGradientToClipboard);
updateGradient();

const pads = Array.from(document.querySelectorAll(".pad"));
const volumeControl = document.getElementById("volume");
const waveControl = document.getElementById("wave");

let audioContext;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

const playTone = (frequency) => {
  const context = getAudioContext();
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = waveControl.value;
  oscillator.frequency.value = frequency;
  gainNode.gain.value = volumeControl.value;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start();
  setTimeout(() => oscillator.stop(), 300);
};

pads.forEach((pad) => {
  pad.addEventListener("click", () => {
    pad.classList.add("playing");
    playTone(Number(pad.dataset.tone));
    setTimeout(() => pad.classList.remove("playing"), 200);
  });
});

const keyMap = ["a", "s", "d", "f", "g", "h", "j", "k"];

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const index = keyMap.indexOf(key);
  if (index === -1) return;
  const pad = pads[index];
  if (!pad) return;
  pad.click();
});
