import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { eventStream } from './eventstream';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

let testEvent = function(args) {
  console.log('testEvent');
  console.log(args);
}
let testEvent2 = (args) => {
  console.log('testEvent2');
  console.log(args);
}
function testEvent3(args) {
  console.log('testEvent3');
  console.log(args);
}
eventStream.registerEvent('test1', testEvent);
eventStream.registerEvent('test1', testEvent2);
eventStream.registerEvent('test1', testEvent3);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
