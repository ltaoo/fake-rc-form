import React from "react";
import ReactDOM from "react-dom";

import { createForm } from "./Form";

import "./styles.css";

class App extends React.Component {
  render() {
    console.log(this.props);
    // const getFieldProps = () => {};
    const { getFieldProps } = this.props.form;
    return (
      <div className="App">
        <h1>Hello CodeSandbox</h1>
        <h2>Start editing to see some magic happen!</h2>
        <input
          {...getFieldProps("required", {
            onChange() {}, // have to write original onChange here if you need
            rules: [{ required: true }]
          })}
        />
      </div>
    );
  }
}

const Form = createForm()(App);

const rootElement = document.getElementById("root");
ReactDOM.render(<Form />, rootElement);
