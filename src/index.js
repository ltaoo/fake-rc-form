import React from "react";
import ReactDOM from "react-dom";

// import { createForm } from "./Form";
import { createForm } from "rc-form";

import "./styles.css";

class App extends React.Component {
  submit = () => {
    const { getFieldsValue, validateFields } = this.props.form;
    //     const values = getFieldsValue();
    //     console.log(values);
    validateFields((err, value) => {
      console.log("validate fields result", err, value);
    });
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
          {...getFieldProps("username", {
            rules: [
              {
                required: true,
                message: "名称必填"
              }
            ]
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
