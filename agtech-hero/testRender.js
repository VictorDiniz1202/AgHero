import React from 'react';
import { renderToString } from 'react-dom/server';
import Login from './src/components/Login.jsx';

try {
  const html = renderToString(React.createElement(Login, {
    onLoginSuccess: () => {},
    onVoltar: () => {}
  }));
  console.log("RENDERED LOGIN SUCCESSFULLY");
} catch (e) {
  console.error("ERROR RENDERING LOGIN:");
  console.error(e.stack);
}
