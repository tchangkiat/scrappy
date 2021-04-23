const month_names = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const log = (message, type = 1) => {
  const typeString =
    type == 2
      ? "WARNING"
      : type == 3
      ? "CRITICAL"
      : type == 4
      ? "ERROR"
      : "INFO";
  const logMessage =
    "[" +
    typeString +
    " - " +
    getCurrentDate() +
    ", " +
    getCurrentTime() +
    "] " +
    message;
  console.log(logMessage);
};

const getCurrentDate = () => {
  var d = new Date();
  return (
    (d.getDate() < 10 ? "0" : "") +
    d.getDate() +
    " " +
    month_names[d.getMonth()] +
    " " +
    d.getFullYear()
  );
};

const getCurrentTime = () => {
  var d = new Date();
  return (
    (d.getHours() < 10 ? "0" : "") +
    d.getHours() +
    ":" +
    (d.getMinutes() < 10 ? "0" : "") +
    d.getMinutes() +
    ":" +
    (d.getSeconds() < 10 ? "0" : "") +
    d.getSeconds()
  );
};

const wait = (milleseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milleseconds));
};

const endsWithAny = (suffixes, string) => {
  return suffixes.some(function (suffix) {
      return string.endsWith(suffix);
  });
}

module.exports = {
  log,
  getCurrentDate,
  getCurrentTime,
  wait,
  endsWithAny,
};
