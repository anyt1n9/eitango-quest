export function getNextWord(words, index) {
  return words[index + 1];
}

export function loadProgress() {
  const raw = localStorage.getItem("progress");
  return JSON.parse(raw);
}