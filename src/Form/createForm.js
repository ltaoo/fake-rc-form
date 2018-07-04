import createBaseForm from "./createBaseForm";

export const mixin = {
  /**
   * 会被添加到组件属性上的方法，BaseForm 会通过该方法给 WrappedComponent 添加 getFieldsValue 等方法
   */
  getForm() {
    return {
      getFieldsValue: this.fieldsStore.getFieldsValue,
      getFieldValue: this.fieldsStore.getFieldValue,
      getFieldInstance: this.getFieldInstance,
      setFieldsValue: this.setFieldsValue,
      setFields: this.setFields,
      // setFieldValue: this.setFieldValue,
      setFieldsInitialValue: this.fieldsStore.setFieldsInitialValue,
      getFieldDecorator: this.getFieldDecorator,
      getFieldProps: this.getFieldProps,
      getFieldsError: this.getFieldsError,
      getFieldError: this.getFieldError,
      isFieldValidating: this.isFieldValidating,
      isFieldsValidating: this.isFieldsValidating,
      isFieldsTouched: this.isFieldsTouched,
      isFieldTouched: this.isFieldTouched,
      isSubmitting: this.isSubmitting,
      submit: this.submit,
      validateFields: this.validateFields,
      resetFields: this.resetFields
    };
  }
};

function createForm(options) {
  return createBaseForm(options, [mixin]);
}

export default createForm;
