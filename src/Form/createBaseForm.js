import React from "react";
import createReactClass from "create-react-class";
// import Asyncvalidator from "async-validator";
import warning from "warning";
import get from "lodash/get";
import set from "lodash/set";

import createFieldsStore from "./createFieldsStore";
import {
  argumentContainer,
  identity,
  normalizeValidateRules,
  getValidateTriggers,
  getValueFromEvent,
  hasRules,
  getParams,
  isEmptyObject,
  flattenArray
} from "./utils";

const DEFAULT_TRIGGER = "onChange";

function createBaseForm(options = {}, mixins = []) {
  const {
    validateMessages,
    onFieldsChange,
    onValuesChange,
    mapProps = identity,
    mapPropsToFields,
    fieldNameProp,
    fieldMetaProp,
    fieldDataProp,
    formPropName = "form",
    withRef
  } = options;
  /**
   * 包装表单组件
   * @param {Component} WrappedComponent - 表单组件
   */
  return function decorate(WrappedComponent) {
    const Form = createReactClass({
      mixins,

      getInitialState() {
        const fields = mapPropsToFields && mapPropsToFields(this.props);
        // 用来管理 field 的 store
        this.fieldsStore = createFieldsStore(fields || {});
        // 所有实例
        this.instances = {};
        this.cacheBind = {};
        this.clearedFieldMetaCache = {};
        // 依次调用
        [
          "getFieldsValue",
          "getFieldValue",
          "setFieldsInitialValue",
          "getFieldsError",
          "getFieldError",
          "isFieldValidating",
          "isFieldsTouched",
          "isFieldTouched"
        ].forEach(
          key =>
            (this[key] = (...args) => {
              return this.fieldsStore[key](...args);
            })
        );

        return {
          submitting: false
        };
      },

      componentWillReceiveProps(nextProps) {
        if (mapPropsToFields) {
          this.fieldsStore.updateFields(mapPropsToFields(nextProps));
        }
      },
      /**
       * 收集数据
       */
      onCollectCommon(name, action, args) {
        const fieldMeta = this.fieldsStore.getFieldMeta(name);
        console.log(fieldMeta, action);
        // 判断事件是否存在
        if (fieldMeta[action]) {
          fieldMeta[action](...args);
        } else if (fieldMeta.originalProps && fieldMeta.originalProps[action]) {
          fieldMeta.originalProps[action](...args);
        }

        const value = fieldMeta.getValueFromEvent
          ? fieldMeta.getValueFromEvent(...args)
          : getValueFromEvent(...args);

        if (onValuesChange && value !== this.fieldsStore.getFieldValue(name)) {
          const valuesAll = this.fieldsStore.getAllValues();
          const valuesAllSet = {};
          valuesAll[name] = value;
          Object.keys(valuesAll).forEach(key =>
            set(valuesAllSet, key, valuesAll[key])
          );
          onValuesChange(this.props, set({}, name, value), valuesAllSet);
        }

        const field = this.fieldsStore.getField(name);
        return {
          name,
          field: {
            ...field,
            value,
            touched: true
          },
          fieldMeta
        };
      },

      onCollect(name_, action, ...args) {
        const { name, field, fieldMeta } = this.onCollectCommon(
          name_,
          action,
          args
        );
        const { validate } = fieldMeta;
        const newField = {
          ...field,
          dirty: hasRules(validate)
        };

        this.setFields({
          [name]: newField
        });
      },
      /**
       * 当输入后，会进行校验
       * @param {string} name_ - 字段名
       * @param {string} action - 事件名
       */
      onCollectValidate(name_, action, ...args) {
        console.log("134", name_, action, args);
        const { field, fieldMeta } = this.onCollectCommon(name_, action, args);
        const newField = {
          ...field,
          dirty: true
        };

        //         this.validateFieldsInternal([newField], {
        //           action,
        //           options: {
        //             firstFields: !!fieldMeta.validateFirst
        //           }
        //         });
      },

      getCacheBind(name, action, fn) {
        if (!this.cacheBind[name]) {
          this.cacheBind[name] = {};
        }

        const cache = this.cacheBind[name];
        if (!cache[action]) {
          cache[action] = fn.bind(this, name, action);
        }
        return cache[action];
      },

      recoverClearedField(name) {
        if (this.clearedFieldMetaCache[name]) {
          this.fieldsStore.setFields({
            [name]: this.clearedFieldMetaCache[name].field
          });
          this.fieldsStore.setFieldMeta(
            name,
            this.clearedFieldMetaCache[name].meta
          );
          // 这样到底是删了什么？应该是 clearedFieldMetaCache 上的 [name] 吧？
          delete this.clearedFieldMetaCache[name];
        }
      },
      // 包装一个组件，成为「字段」
      getFieldDecorator(name, fieldOption) {
        const props = this.getFieldProps(name, fieldOption);
        // 返回一个函数，用来包装我们的表单组件如 Input
        return fieldElem => {
          const fieldMeta = this.fieldsStore.getFieldMeta(name);
          // 原始 props
          const originalProps = fieldElem.props;
          fieldMeta.originalProps = originalProps;
          fieldMeta.ref = fieldElem.ref;

          return React.cloneElement(fieldElem, {
            ...props,
            // 当使用 getFieldDecorator 后，Form 组件会「接管」onChange 以及 value 属性
            ...this.fieldsStore.getFieldValuePropsValue(fieldMeta)
          });
        };
      },
      /**
       * 初始化 Field，即声明了一个字段，并配置该字段 name、options
       */
      getFieldProps(name, usersFieldOption = {}) {
        if (!name) {
          throw new Error("Must call `getFieldProps` with valid name string");
        }
        delete this.clearedFieldMetaCache[name];
        const fieldOption = {
          name,
          trigger: DEFAULT_TRIGGER,
          valuePropName: "value",
          validate: [],
          ...usersFieldOption
        };

        const {
          rules,
          trigger,
          validateTrigger = trigger,
          validate
        } = fieldOption;

        const fieldMeta = this.fieldsStore.getFieldMeta(name);
        // 初始值
        if ("initialValue" in fieldOption) {
          fieldMeta.initialValue = fieldOption.initialValue;
        }

        const inputProps = {
          ...this.fieldsStore.getFieldValuePropValue(fieldOption),
          ref: this.getCacheBind(name, `${name}__ref`, this.saveRef)
        };
        if (fieldNameProp) {
          inputProps[fieldNameProp] = name;
        }

        const validateRules = normalizeValidateRules(
          validate,
          rules,
          validateTrigger
        );
        const validateTriggers = getValidateTriggers(validateRules);
        // 校验触发器，遍历
        validateTriggers.forEach(action => {
          if (inputProps[action]) {
            return;
          }
          inputProps[action] = this.getCacheBind(
            name,
            action,
            this.onCollectValidate
          );
        });
        // 确保 value 被收集了
        if (trigger && validateTriggers.indexOf(trigger) === -1) {
          inputProps[trigger] = this.getCacheBind(
            name,
            trigger,
            this.onCollect
          );
        }
        // 元信息
        const meta = {
          ...fieldMeta,
          ...fieldOption,
          validate: validateRules
        };
        this.fieldsStore.setFieldMeta(name, meta);
        if (fieldMetaProp) {
          inputProps[fieldMetaProp] = meta;
        }
        if (fieldDataProp) {
          inputProps[fieldDataProp] = this.fieldsStore.getField(name);
        }
        return inputProps;
      },

      getFieldInstance(name) {
        return this.instances[name];
      },

      getRules(fieldMeta, action) {
        // 获取到可执行的 rules
        const actionRules = fieldMeta.validate.filter(item => {
          // action 存在，并且 action 属于 trigger 的元素
          return !action || item.trigger.indexOf(action) >= 0;
        });
        return flattenArray(actionRules);
      },
      /**
       * 设置字段的值
       */
      setFields(maybeNestedFields, callback) {
        const fields = this.fieldsStore.flattenRegisteredFields(
          maybeNestedFields
        );
        this.fieldsStore.setFields(fields);
        if (onFieldsChange) {
          const changedFields = Object.keys(fields).reduce((acc, name) => {
            return set(acc, name, this.fieldsStore.getField(name));
          }, {});
          onFieldsChange(
            this.props,
            changedFields,
            this.fieldsStore.getNestedAllFields()
          );
        }

        this.forceUpdate(callback);
      },
      /**
       * 重置字段为初始状态
       * @param {string[] || string} ns - 要重置的字段名
       */
      resetFields(ns) {
        const newFields = this.fieldsStore.resetFields(ns);
        if (Object.keys(newFields).length > 0) {
          this.setFields(newFields);
        }
        if (ns) {
          const names = Array.isArray(ns) ? ns : [ns];
          names.forEach(name => delete this.clearedFieldMetaCache[name]);
        } else {
          this.clearedFieldMetaCache = {};
        }
      },
      /**
       * 给指定字段设置值
       */
      setFieldsValue(changedValues, callback) {
        const { fieldsMeta } = this.fieldsStore;
        const values = this.fieldsStore.flattenRegisteredFields(changedValues);
        const newFields = Object.keys(values).reduce((acc, name) => {
          const isRegistered = fieldsMeta[name];
          if (isRegistered) {
            const value = values[name];
            acc[name] = {
              value
            };
          }
          return acc;
        }, {});
        this.setFields(newFields, callback);
        if (onValuesChange) {
          const allValues = this.fieldsStore.getAllValues();
          onValuesChange(this.props, changedValues, allValues);
        }
      },

      saveRef(name, _, component) {
        if (!component) {
          this.clearedFieldMetaCache[name] = {
            field: this.fieldsStore.getField(name),
            meta: this.fieldsStore.getFieldMeta(name)
          };
          this.fieldsStore.clearField(name);
          delete this.instances[name];
          delete this.cacheBind[name];
          return;
        }
        // todo
      },

      isSubmitting() {
        return this.state.submitting;
      },
      /**
       * 提交表单
       */
      submit(callback) {
        const fn = () => {
          this.setState({
            submitting: false
          });
        };
        this.setState({
          submitting: true
        });
        callback(fn);
      },

      render() {
        const { wrappedComponentRef, ...restProps } = this.props;
        const formProps = {
          // 表单属性名，默认是 form
          [formPropName]: this.getForm()
        };
        if (withRef) {
        } else if (wrappedComponentRef) {
          formProps.ref = wrappedComponentRef;
        }
        const props = mapProps.call(this, {
          ...formProps,
          ...restProps
        });
        // 最终传给被包装组件的属性，就是 form: {...}
        return <WrappedComponent {...props} />;
      }
    });

    return argumentContainer(Form, WrappedComponent);
  };
}

export default createBaseForm;
