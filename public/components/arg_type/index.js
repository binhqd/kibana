import { connect } from 'react-redux';
import { get, flowRight } from 'lodash';
import { branch, renderComponent, withProps } from 'recompose';
import { ArgType as Component } from './arg_type';
import { ArgTypeUnknown } from './arg_type_unknown';
import { ArgTypeContextPending } from './arg_type_context_pending';
import { ArgTypeContextError } from './arg_type_context_error';
import { findExpressionType } from '../../lib/find_expression_type';
import { fetchContext, setArgumentAtIndex } from '../../state/actions/elements';
import {
  getSelectedElement,
  getSelectedPage,
  getSelectedResolvedArgs,
} from '../../state/selectors/workpad';

function contextRequired(expressionType) {
  return Boolean(expressionType && expressionType.requiresContext);
}

const mapStateToProps = (state, { expressionIndex }) => {
  const resolvedArgs = getSelectedResolvedArgs(state);

  return {
    context: get(resolvedArgs, ['expressionContext', expressionIndex - 1], null),
    element: getSelectedElement(state),
    pageId: getSelectedPage(state),
  };
};

const mapDispatchToProps = ({
  fetchContext,
  setArgumentAtIndex,
});

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const { context, element, pageId } = stateProps;
  const { expressionIndex, expressionType } = ownProps;

  const props = Object.assign({}, stateProps, dispatchProps, ownProps, {
    updateContext: () => dispatchProps.fetchContext({ index: expressionIndex }),
    onValueChange: (arg) => dispatchProps.setArgumentAtIndex({
      arg,
      element,
      pageId,
      index: expressionIndex,
    }),
  });

  if (context == null && contextRequired(expressionType)) {
    props.updateContext();
  }

  return props;
};

const contextPending = branch(
  ({ context, expressionType }) => {
    const isPending = (!context || context.state === 'pending');
    return contextRequired(expressionType) && isPending;
  },
  renderComponent(ArgTypeContextPending)
);

const contextError = branch(
  ({ context, expressionType }) => {
    const isError = (context && context.state === 'error');
    return contextRequired(expressionType) && isError;
  },
  renderComponent(ArgTypeContextError)
);

const nullExpressionType = branch(
  props => !props.expressionType,
  renderComponent(ArgTypeUnknown)
);

const appendProps = withProps(({ argType, nextArgType }) => {
  const expressionType = findExpressionType(argType);
  const nextExpressionType = nextArgType ? findExpressionType(nextArgType) : nextArgType;
  return {
    expressionType,
    nextExpressionType,
    name: get(expressionType, 'displayName', argType),
  };
});

export const ArgType = flowRight([
  appendProps,
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  nullExpressionType,
  contextPending,
  contextError,
])(Component);
