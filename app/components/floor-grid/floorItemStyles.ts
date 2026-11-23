import styles from "./PalletSlot.module.css";
import type { FloorItemType, PalletStatus } from "./types";

export const FLOOR_ITEM_STYLES: Record<FloorItemType, string> = {
  pallet: styles.pallet,
  "walking-lane": styles.walkingLane,
  desk: styles.desk,
  shelf: styles.shelf,
  rack: styles.rack,
  other: styles.other,
};

export const PALLET_STATUS_STYLES: Record<PalletStatus, string> = {
  empty: `${styles.palletStatus} ${styles.palletStatusEmpty}`,
  "in-progress": `${styles.palletStatus} ${styles.palletStatusInProgress}`,
  "on-hold": `${styles.palletStatus} ${styles.palletStatusOnHold}`,
  "direct-sale": `${styles.palletStatus} ${styles.palletStatusDirectSale}`,
  "dc-techs": `${styles.palletStatus} ${styles.palletStatusDcTechs}`,
  "other-building": `${styles.palletStatus} ${styles.palletStatusTransfer}`,
  inactive: `${styles.palletStatus} ${styles.palletStatusInactive}`,
  "put-on-shelf": `${styles.palletStatus} ${styles.palletStatusShelf}`,
  "take-down-from-shelf": `${styles.palletStatus} ${styles.palletStatusShelf}`,
};

export const PALLET_STATUS_BADGES: Partial<Record<PalletStatus, string>> = {
  "put-on-shelf": styles.shelfMovementBadge,
  "take-down-from-shelf": styles.shelfMovementBadge,
};
