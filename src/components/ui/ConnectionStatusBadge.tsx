/**
 * @deprecated Use `BridgeStatusIndicator` from './BridgeStatusIndicator'.
 *
 * Kept as a thin re-export so the existing project-setup call sites
 * (BridgeEndpointHealth / LiveStateSyncPanel / UE5RemoteController)
 * continue to work unchanged. New surfaces should import
 * `BridgeStatusIndicator` directly.
 */
export {
  BridgeStatusIndicator,
  ConnectionStatusBadge,
  type ConnectionStatus,
  type BridgeVariant,
} from './BridgeStatusIndicator';
