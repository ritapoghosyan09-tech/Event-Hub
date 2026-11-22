import "server-only";
import { db } from "./db";
import { claimGuestBookingsWith, mergeFavoritesWith } from "./accounts-core";

export function claimGuestBookings(userId: string, email: string) {
  return claimGuestBookingsWith(db, userId, email);
}

export function mergeFavorites(userId: string, eventIds: string[]) {
  return mergeFavoritesWith(db, userId, eventIds);
}
