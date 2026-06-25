import { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome5, Octicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export const isAndroid = Platform.OS === 'android';
export const isIOS = Platform.OS === 'ios';

export { Ionicons, MaterialCommunityIcons, MaterialIcons, FontAwesome5, Octicons };