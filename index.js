// @flow

import * as React from "react";
import {
  PanResponder,
  View,
  Dimensions,
  Animated,
  StyleSheet,
  TouchableWithoutFeedback
} from "react-native";
import PropTypes from "prop-types";
import styles from "./styles";

import type { PanResponderInstance } from "PanResponder";

type WindowDimensions = {| width: number, height: number |};

type Props = {|
  leftAnimatedValue: Animated.Value,
  edgeHitWidth: number,
  toleranceX: number,
  toleranceY: number,
  menuPosition: "left" | "right",
  onChange: Function,
  onMove: Function,
  onSliding: Function,
  openMenuOffset: number,
  hiddenMenuOffset: number,
  disableGestures: Function | boolean,
  animationFunction: Function,
  animationStyle: Function,
  onAnimationComplete: boolean => void,
  onStartShouldSetResponderCapture: Function,
  isOpen: boolean,
  bounceBackOnOverdraw: boolean,
  autoClosing: boolean,
  leftAnimatedValue: Animated.Value,
  menu: React.Node,
  children: React.Node
|};

type Event = {|
  nativeEvent: {|
    layout: {|
      width: number,
      height: number
    |}
  |}
|};

type State = {|
  width: number,
  height: number,
  openOffsetMenuPercentage: number,
  openMenuOffset: number,
  hiddenMenuOffsetPercentage: number,
  hiddenMenuOffset: number
|};

const deviceScreen: WindowDimensions = Dimensions.get("window");
const barrierForward: number = deviceScreen.width / 4;

function shouldOpenMenu(dx: number): boolean {
  return dx > barrierForward;
}

export default class SideMenu extends React.Component<Props, State> {
  onLayoutChange: Function;
  onStartShouldSetResponderCapture: Function;
  onMoveShouldSetPanResponder: Function;
  onPanResponderMove: Function;
  onPanResponderRelease: Function;
  onPanResponderTerminate: Function;
  responder: PanResponderInstance;
  prevLeft: number;
  isOpen: boolean;
  isAnimating: boolean;
  sideMenu: React.Node;

  static defaultProps = {
    toleranceY: 10,
    toleranceX: 10,
    edgeHitWidth: 60,
    children: null,
    menu: null,
    openMenuOffset: deviceScreen.width * (2 / 3),
    disableGestures: false,
    menuPosition: "left",
    hiddenMenuOffset: 0,
    onMove: () => {},
    onStartShouldSetResponderCapture: () => false,
    onChange: () => {},
    onSliding: () => {},
    animationStyle: (value: Animated.Value) => ({
      transform: [
        {
          translateX: value
        }
      ]
    }),
    animationFunction: (prop: Animated.Value, value: number) =>
      Animated.spring(prop, {
        toValue: value,
        useNativeDriver: false,
        friction: 8
      }),
    isOpen: false,
    bounceBackOnOverdraw: true,
    autoClosing: true
  };

  constructor(props: Props) {
    super(props);

    this.prevLeft = 0;
    this.isOpen = !!props.isOpen;
    this.isAnimating = false;

    const openOffsetMenuPercentage = props.openMenuOffset / deviceScreen.width;
    const hiddenMenuOffsetPercentage =
      props.hiddenMenuOffset / deviceScreen.width;

    this.onLayoutChange = this.onLayoutChange.bind(this);
    this.onStartShouldSetResponderCapture = props.onStartShouldSetResponderCapture.bind(
      this
    );
    this.onMoveShouldSetPanResponder = this.handleMoveShouldSetPanResponder.bind(
      this
    );
    this.onPanResponderMove = this.handlePanResponderMove.bind(this);
    this.onPanResponderRelease = this.handlePanResponderEnd.bind(this);
    this.onPanResponderTerminate = this.handlePanResponderEnd.bind(this);

    this.state = {
      width: deviceScreen.width,
      height: deviceScreen.height,
      openOffsetMenuPercentage,
      openMenuOffset: deviceScreen.width * openOffsetMenuPercentage,
      hiddenMenuOffsetPercentage,
      hiddenMenuOffset: deviceScreen.width * hiddenMenuOffsetPercentage
    };

    this.props.leftAnimatedValue.addListener(({ value }) => {
      this.props.onSliding(
        Math.abs(
          (value - this.state.hiddenMenuOffset) /
            (this.state.openMenuOffset - this.state.hiddenMenuOffset)
        )
      );
    });
  }

  UNSAFE_componentWillMount(): void {
    this.responder = PanResponder.create({
      onStartShouldSetPanResponderCapture: this
        .onStartShouldSetResponderCapture,
      onMoveShouldSetPanResponder: this.onMoveShouldSetPanResponder,
      onPanResponderMove: this.onPanResponderMove,
      onPanResponderRelease: this.onPanResponderRelease,
      onPanResponderTerminate: this.onPanResponderTerminate
    });
  }

  UNSAFE_componentWillReceiveProps(props: Props): void {
    if (
      typeof props.isOpen !== "undefined" &&
      this.isOpen !== props.isOpen &&
      !this.isAnimating &&
      (props.autoClosing || this.isOpen === false)
    ) {
      this.openMenu(props.isOpen);
    }
  }

  onLayoutChange(e: Event) {
    const { width, height } = e.nativeEvent.layout;
    const openMenuOffset = width * this.state.openOffsetMenuPercentage;
    const hiddenMenuOffset = width * this.state.hiddenMenuOffsetPercentage;
    this.setState({ width, height, openMenuOffset, hiddenMenuOffset });
  }

  /**
   * Get content view. This view will be rendered over menu
   * @return {React.Component}
   */
  getContentView() {
    let overlay: React.Node = null;

    if (this.isOpen) {
      overlay = (
        <TouchableWithoutFeedback
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          onPress={() => this.openMenu(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      );
    }

    const { width, height } = this.state;
    const ref = sideMenu => (this.sideMenu = (sideMenu: any));
    const style = [
      styles.frontView,
      { width, height },
      this.props.animationStyle(this.props.leftAnimatedValue)
    ];

    return (
      <Animated.View style={style} ref={ref} {...this.responder.panHandlers}>
        {this.props.children}
        {overlay}
      </Animated.View>
    );
  }

  moveLeft(offset: number) {
    const newOffset = this.menuPositionMultiplier() * offset;

    this.isAnimating = true;
    this.props
      .animationFunction(this.props.leftAnimatedValue, newOffset)
      .start(this.handleAnimationComplete);

    this.prevLeft = newOffset;
  }

  menuPositionMultiplier(): -1 | 1 {
    return this.props.menuPosition === "right" ? -1 : 1;
  }

  handleAnimationComplete = () => {
    this.isAnimating = false;

    if (this.props.onAnimationComplete) {
      this.props.onAnimationComplete(this.isOpen);
    }
  };

  handlePanResponderMove(e: Object, gestureState: Object) {
    if (
      this.props.leftAnimatedValue.__getValue() *
        this.menuPositionMultiplier() >=
      0
    ) {
      let newLeft = this.prevLeft + gestureState.dx;

      if (
        !this.props.bounceBackOnOverdraw &&
        Math.abs(newLeft) > this.state.openMenuOffset
      ) {
        newLeft = this.menuPositionMultiplier() * this.state.openMenuOffset;
      }

      this.props.onMove(newLeft);
      this.props.leftAnimatedValue.setValue(newLeft);
    }
  }

  handlePanResponderEnd(e: Object, gestureState: Object) {
    const offsetLeft =
      this.menuPositionMultiplier() *
      (this.props.leftAnimatedValue.__getValue() + gestureState.dx);

    this.openMenu(shouldOpenMenu(offsetLeft));
  }

  handleMoveShouldSetPanResponder(e: any, gestureState: any): boolean {
    if (this.gesturesAreEnabled()) {
      const x = Math.round(Math.abs(gestureState.dx));
      const y = Math.round(Math.abs(gestureState.dy));

      const touchMoved = x > this.props.toleranceX && y < this.props.toleranceY;

      if (this.isOpen) {
        return touchMoved;
      }

      const withinEdgeHitWidth =
        this.props.menuPosition === "right"
          ? gestureState.moveX > deviceScreen.width - this.props.edgeHitWidth
          : gestureState.moveX < this.props.edgeHitWidth;

      const swipingToOpen = this.menuPositionMultiplier() * gestureState.dx > 0;
      return withinEdgeHitWidth && touchMoved && swipingToOpen;
    }

    return false;
  }

  openMenu(isOpen: boolean): void {
    const { hiddenMenuOffset, openMenuOffset } = this.state;
    this.moveLeft(isOpen ? openMenuOffset : hiddenMenuOffset);
    this.isOpen = isOpen;

    this.forceUpdate();
    this.props.onChange(isOpen);
  }

  gesturesAreEnabled(): boolean {
    const { disableGestures } = this.props;

    if (typeof disableGestures === "function") {
      return !disableGestures();
    }

    return !disableGestures;
  }

  render() {
    const boundryStyle =
      this.props.menuPosition === "right"
        ? { left: this.state.width - this.state.openMenuOffset }
        : { right: this.state.width - this.state.openMenuOffset };

    const menu = (
      <View style={[styles.menu, boundryStyle]}>{this.props.menu}</View>
    );

    return (
      <View style={styles.container} onLayout={this.onLayoutChange}>
        {menu}
        {this.getContentView()}
      </View>
    );
  }
}

SideMenu.propTypes = {
  edgeHitWidth: PropTypes.number,
  toleranceX: PropTypes.number,
  toleranceY: PropTypes.number,
  menuPosition: PropTypes.oneOf(["left", "right"]),
  onChange: PropTypes.func,
  onMove: PropTypes.func,
  children: PropTypes.node,
  menu: PropTypes.node,
  openMenuOffset: PropTypes.number,
  hiddenMenuOffset: PropTypes.number,
  animationStyle: PropTypes.func,
  disableGestures: PropTypes.oneOfType([PropTypes.func, PropTypes.bool]),
  animationFunction: PropTypes.func,
  onAnimationComplete: PropTypes.func,
  onStartShouldSetResponderCapture: PropTypes.func,
  isOpen: PropTypes.bool,
  bounceBackOnOverdraw: PropTypes.bool,
  autoClosing: PropTypes.bool
};

SideMenu.defaultProps = {
  toleranceY: 10,
  toleranceX: 10,
  edgeHitWidth: 60,
  children: null,
  menu: null,
  openMenuOffset: deviceScreen.width * (2 / 3),
  disableGestures: false,
  menuPosition: 'left',
  hiddenMenuOffset: 0,
  onMove: () => {},
  onStartShouldSetResponderCapture: () => false,
  onChange: () => {},
  onSliding: () => {},
  animationStyle: value => ({
    transform: [{
      translateX: value,
    }],
  }),
  animationFunction: (prop, value) => Animated.spring(prop, {
    toValue: value,
    friction: 8,
    useNativeDriver: true,
  }),
  onAnimationComplete: () => {},
  isOpen: false,
  bounceBackOnOverdraw: true,
  autoClosing: true,
};
