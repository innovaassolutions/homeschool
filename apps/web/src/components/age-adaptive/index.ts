// Age-Adaptive Interface Framework
// Exports for easy importing of age-adaptive components

// Core Components
export { AgeAdaptiveWrapper } from './AgeAdaptiveWrapper';

// Age-Specific UI Components
export {
  UIAges6to9,
  Button6to9,
  Card6to9,
  Navigation6to9,
  ProgressIndicator6to9
} from './UIAges6to9';

export {
  UIAges10to13,
  Button10to13,
  Card10to13,
  Navigation10to13,
  ProgressIndicator10to13
} from './UIAges10to13';

export {
  UIAges14to16,
  Button14to16,
  Card14to16,
  Navigation14to16,
  ProgressIndicator14to16
} from './UIAges14to16';

// Navigation System
export {
  AgeAdaptiveNavigation,
  SimpleNavigation,
  type NavigationItem
} from './AgeAdaptiveNavigation';

export {
  NavigationProvider,
  useNavigation,
  useRouteRegistration,
  getNavigationConfig,
  type NavigationRoute,
  type NavigationContextType,
  type NavigationOptions
} from './NavigationProvider';

export {
  Breadcrumbs,
  Wayfinding,
  type BreadcrumbItem,
  type BreadcrumbsProps,
  type WayfindingProps
} from './Breadcrumbs';

// Interaction Support
export { InteractionTestComponent } from './InteractionTestComponent';

// Hooks
export { useAgeAdaptive, type AgeGroup, type AgeTheme, type AgeAdaptiveConfig } from '../../hooks/useAgeAdaptive';
export { useTouchGestures, type TouchGestureConfig } from '../../hooks/useTouchGestures';
export { useInteractionStates, getInteractionClasses, type InteractionStates, type InteractionStatesConfig } from '../../hooks/useInteractionStates';