import React from "react";
import ReactDOM from "react-dom";

import { createForm } from "./Form";

import "./styles.css";

class App extends React.Component {
  submit = () => {
    const { getFieldsValue } = this.props.form;
    //     getFieldsValue(["name"], (err, values) => {
    //       console.log(err, values);
    //     });
    const values = getFieldsValue();
    console.log(values);
  };
  render() {
    console.log(this.props);
    // const getFieldProps = () => {};
    const { getFieldProps } = this.props.form;
    return (
      <div className="App">
        <h1>Hello CodeSandbox</h1>
        <h2>Start editing to see some magic happen!</h2>
        <input
          {...getFieldProps("name", {
            onChange() {}, // have to write original onChange here if you need
            rules: [{ required: true }]
          })}
        />
        <button onClick={this.submit}>submit</button>
      </div>
    );
  }
}

const Form = createForm()(App);

const rootElement = document.getElementById("root");
ReactDOM.render(<Form />, rootElement);
