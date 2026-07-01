import { Dimensions } from 'react-native';
import { Easing } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const pageTransition = {
  config: { duration: 350, easing: Easing.out(Easing.cubic) },
  style: {
    opacity: { duration: 250 },
    transform: [{
      translateX: {
        duration: 350,
        easing: Easing.out(Easing.cubic),
      }
    }]
  }
};

export const fadeSlideUp = {
  initial: { opacity: 0, translateY: 20 },
  animate: { opacity: 1, translateY: 0 },
  exit: { opacity: 0, translateY: -10 },
  transition: { duration: 400, easing: Easing.out(Easing.cubic) }
};

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } }
};

export const staggerItem = {
  initial: { opacity: 0, translateY: 15 },
  animate: { opacity: 1, translateY: 0, transition: { duration: 350, easing: Easing.out(Easing.cubic) } }
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1, transition: { duration: 300, easing: Easing.out(Easing.cubic) } }
};

export const slideInRight = {
  initial: { opacity: 0, translateX: 30 },
  animate: { opacity: 1, translateX: 0, transition: { duration: 350, easing: Easing.out(Easing.cubic) } }
};

export const pulseAnimation = {
  0: { scale: 1 },
  0.5: { scale: 1.05 },
  1: { scale: 1 },
};