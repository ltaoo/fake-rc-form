import React from "react";
import createReactClass from "create-react-class";
import Asyncvalidator from "async-validator";
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
        // console.log(fieldMeta, action);
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
        // console.log("134", name_, action, args);
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
        debugger;
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
        const actionRules = fieldMeta.validate
          .filter(item => {
            // action 存在，并且 action 属于 trigger 的元素
            return !action || item.trigger.indexOf(action) >= 0;
          })
          .map(item => item.rules);
        console.log(fieldMeta.validate, actionRules);
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
      /**
       * 当字段存在 rules 时，通过该方法进行校验
       */
      validateFieldsInternal(
        fields,
        { fieldNames, action, options = {} },
        callback
      ) {
        const allRules = {};
        const allValues = {};
        const allFields = {};
        const alreadyErrors = {};
        fields.forEach(field => {
          const name = field.name;
          // 如果没有配置强制校验，并且该字段 dirty 是 false，表示不需要校验？就不校验了
          if (options.force !== true && field.dirty === false) {
            if (field.errors) {
              set(alreadyErrors, name, { errors: field.errors });
            }
            return;
          }
          const fieldMeta = this.fieldsStore.getFieldMeta(name);
          const newField = {
            ...field
          };
          newField.errors = undefined;
          newField.validating = true;
          newField.dirty = true;
          allRules[name] = this.getRules(fieldMeta, action);
          // 这里有什么意义？下面又覆盖了
          allValues[name] = newField.value;
          allFields[name] = newField;
        });
        this.setFields(allFields);
        Object.keys(allValues).forEach(f => {
          allValues[f] = this.fieldsStore.getFieldValue(f);
        });
        console.log("all fields is empty", isEmptyObject(allFields));
        if (callback && isEmptyObject(allFields)) {
          callback(
            isEmptyObject(alreadyErrors) ? null : alreadyErrors,
            this.fieldsStore.getFieldsValue(fieldNames)
          );
          return;
        }
        const validator = new Asyncvalidator(allRules);
        if (validateMessages) {
          // 设置错误提示
          validator.messages(validateMessages);
        }
        console.log("real rules is", allRules, allValues);
        validator.validate(allValues, options, errors => {
          console.log("validate by Validator", errors);
          const errorsGroup = {
            ...alreadyErrors
          };
          if (errors && errors.length) {
            errors.forEach(e => {
              const fieldName = e.field;
              const field = get(errorsGroup, fieldName);
              if (typeof field !== "object" || Array.isArray(field)) {
                set(errorsGroup, fieldName, { errors: [] });
              }
              const fieldErrors = get(errorsGroup, fieldName.concat(".errors"));
              fieldErrors.push(e);
            });
          }
          const expired = [];
          const nowAllFields = {};
          Object.keys(allRules).forEach(name => {
            const fieldErrors = get(errorsGroup, name);
            const nowField = this.fieldsStore.getField(name);
            // 避免 concurrency 问题？
            if (nowField.value !== allValues[name]) {
              // 过期了
              expired.push({
                name
              });
            } else {
              nowField.errors = fieldErrors && fieldErrors.errors;
              nowField.value = allValues[name];
              nowField.validating = false;
              nowField.dirty = false;
              nowAllFields[name] = nowField;
            }
          });
          // 重新设置 fields ?
          this.setFields(nowAllFields);
          if (callback) {
            // 存在过期的字段
            if (expired.length) {
              expired.forEach(({ name }) => {
                const fieldErrors = [
                  {
                    message: `${name} need to revalidate`,
                    field: name
                  }
                ];
                set(errorsGroup, name, {
                  expired: true,
                  errors: fieldErrors
                });
              });
            }
            // console.log(errorsGroup);
            callback(
              isEmptyObject(errorsGroup) ? null : errorsGroup,
              this.fieldsStore.getFieldsValue(fieldNames)
            );
          }
        });
      },
      /**
       * 校验字段
       * @param {string[]} ns - 字段名
       * @param {Option} opt
       * @param {Function} cb
       */
      validateFields(ns, opt, cb) {
        // 因为传的参数顺序不一定是 ns、opt、cb 这样，所以通过 getParams 处理，可以算「适配器」模式？
        const { names, callback, options } = getParams(ns, opt, cb);
        // console.log("validating", names, callback, options);
        const fieldNames = names
          ? this.fieldsStore.getValidFieldsFullName(names)
          : this.fieldsStore.getValidFieldsName();
        // 获取到有配置 rules 的字段
        const fields = fieldNames
          .filter(name => {
            const fieldMeta = this.fieldsStore.getFieldMeta(name);
            return hasRules(fieldMeta.validate);
          })
          .map(name => {
            const field = this.fieldsStore.getField(name);
            field.value = this.fieldsStore.getFieldValue(name);
            return field;
          });
        // 如果没有任何字段配置了rules 字段
        if (!fields.length) {
          if (callback) {
            callback(null, this.fieldsStore.getFieldsValue(fieldNames));
          }
          return;
        }
        // 如果 firstFields 不在 options 配置中，就找出 fields 中配置了 firstFields 的字段
        if (!("firstFields" in options)) {
          options.firstFields = fieldNames.filter(name => {
            const fieldMeta = this.fieldsStore.getFieldMeta(name);
            return !!fieldMeta.validateFirst;
          });
        }
        // console.log("507", fieldNames, options, fields, callback);
        // 如果有配置 rules，就交给 validateFieldsInternal 处理
        this.validateFieldsInternal(
          fields,
          {
            fieldNames,
            options
          },
          callback
        );
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
