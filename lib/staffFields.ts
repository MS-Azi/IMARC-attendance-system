/** Staff fields safe to send to the admin UI — never passwordHash or device-binding internals. */
export const ADMIN_STAFF_SELECT = {
  id: true,
  fullName: true,
  loginId: true,
  position: true,
  staffCode: true,
  department: true,
  dateJoined: true,
  active: true,
  workMode: true,
} as const;
