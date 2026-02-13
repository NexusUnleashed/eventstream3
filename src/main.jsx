import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App.jsx";
import "./eventstream";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

let testEvent = function (args) {
  console.log("testEvent");
  console.log(args);
};
let testEvent2 = (args) => {
  console.log("testEvent2");
  console.log(args);
};
function testEvent3(args) {
  console.log("testEvent3");
  console.log(args);
}
window.eventStream.registerEvent("test1", testEvent);
window.eventStream.registerEvent("test1", testEvent2);
window.eventStream.registerEvent("test1", testEvent3);
