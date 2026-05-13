// app/sadmin_tabs/styles.ts
import { StyleSheet } from "react-native";

export const COLORS = {
  primary: "#4A90E2",
  success: "#44bd32",
  danger: "#E74C3C",
  warning: "#F39C12",
  
  background: "#f5f5f5",
  surface: "#fff",
  surfaceAlt: "#f9f9f9",
  surfaceLight: "#f8f9fa",
  
  text: "#333",
  textSecondary: "#555",
  textTertiary: "#666",
  textMuted: "#777",
  textDim: "#888",
  textLight: "#999",
  textWhite: "#fff",
  
  border: "#ccc",
  borderLight: "#eee",
  borderLighter: "#f0f0f0",
  borderDark: "#e0e0e0",
  
  shadow: "#000",
  
  backdrop: "rgba(0,0,0,0.3)",
  alertBackdrop: "rgba(0,0,0,0.4)",
  overlay: "rgba(255, 255, 255, 0.7)",
};

export const styles = StyleSheet.create({
  /** =============================================
   *                   LAYOUT
   * ============================================== */
  container: { flex: 1, backgroundColor: COLORS.background, padding: 16 },
  sectionTitle: { fontWeight: "700", fontSize: 18, marginBottom: 12 },
  metricsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  panelCard: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  panelTitle: { fontWeight: "700", fontSize: 18, marginBottom: 8 },

  /** =============================================
   *                  COMPONENTS
   * ============================================== */
  /* --- Dashboard Cards --- */
  dashboardCard: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    flexBasis: "48%",
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "visible",
  },
  metricTitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 4 },
  metricValue: { fontSize: 16, fontWeight: "700" },

  /* --- Pie Chart & Legends --- */
  pieRow: { flexDirection: "row", alignItems: "center", paddingVertical: 16 },
  pieCenter: { position: "absolute", justifyContent: "center", alignItems: "center", width: "100%", height: "100%" },
  pieCenterNumber: { fontSize: 18, fontWeight: "800" },
  pieCenterLabel: { fontSize: 12, color: COLORS.textTertiary },
  legendContainer: { marginLeft: 20, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  pieLegendRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, // Kept for backward compatibility if used elsewhere
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { fontSize: 14, fontWeight: "600" },
  barChartLegend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 12 },

  /* --- Bar Chart --- */
  horizontalBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  horizontalBarLabel: { width: '25%', fontSize: 12 },
  horizontalBar: { flex: 1, height: 16, backgroundColor: COLORS.borderLighter, borderRadius: 8, marginRight: 8 },
  horizontalBarFill: { height: '100%', backgroundColor: COLORS.danger, borderRadius: 8 },
  horizontalBarValue: { fontSize: 12, fontWeight: '600', minWidth: 20, textAlign: 'right' },

  /* --- Progress Bar --- */
  progressBarContainer: { height: 8, backgroundColor: COLORS.borderLight, borderRadius: 4, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 4 },

  /** =============================================
   *                    MODULES
   * ============================================== */
  /* --- System Health Module --- */
  healthGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  healthGridItem: { flex: 1, padding: 8, borderRadius: 8, backgroundColor: COLORS.surfaceAlt, marginHorizontal: 4 },
  healthStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  healthLabel: { fontSize: 14, fontWeight: "600" },
  healthStatus: { fontSize: 12, color: COLORS.textSecondary },
  healthUsageRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },

  /* --- Violation Breakdown --- */
  violationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  violationLabel: { width: '25%', fontSize: 14, fontWeight: '600' },
  violationBarContainer: { flex: 1, height: 20, backgroundColor: COLORS.borderLight, borderRadius: 5, marginHorizontal: 8, justifyContent: 'center' },
  violationBar: { height: '100%', borderRadius: 5, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 5 },
  violationCount: { fontSize: 14, fontWeight: '700', minWidth: 25, textAlign: 'right' },
  violationBarText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  /* --- Flagged Users Module --- */
  flaggedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.borderLighter },
  flaggedItemIcon: { marginRight: 12 },
  flaggedItemContent: { flex: 1 },
  flaggedItemUser: { fontSize: 14, fontWeight: '600' },
  flaggedItemDate: { fontSize: 12, color: COLORS.textMuted },
  flaggedItemTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  flaggedItemTagText: { color: COLORS.textWhite, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
  emptyStateText: {
    textAlign: 'center',
    paddingVertical: 20,
    color: COLORS.textDim,
    fontSize: 14,
  },

  /* --- Live Activity Item --- */
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: COLORS.borderLighter,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  activityItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityItemContent: {
    flex: 1,
    justifyContent: 'center',
  },
  activityItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  activityItemSubtitle: {
    fontSize: 12,
    color: COLORS.textDim,
  },
  activityItemTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  activityItemTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textWhite,
  },

  /* --- User List Module --- */
  userListContainer: { flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: COLORS.background },
  userListControls: { flexDirection: "row", marginBottom: 12, gap: 8 },
  userListBulkActions: { flexDirection: "row", marginBottom: 12, gap: 8, alignItems: 'center' },
  bulkActionButton: { flexDirection: 'row', padding: 10, borderRadius: 8, justifyContent: "center", alignItems: "center", flex: 1 },
  bulkActionButtonText: { color: COLORS.textWhite, fontWeight: "700" },
  cancelBulkActionButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.borderDark },
  cancelBulkActionButtonText: { color: COLORS.textSecondary, fontWeight: '600' },
  clearSearchButton: { position: "absolute", right: 8, top: 0, bottom: 0, justifyContent: 'center', padding: 4 },
  searchInput: {
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    flex: 1,
  },
  sortButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: 100, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8, gap: 6 },
  sortButtonText: { color: COLORS.textWhite, fontWeight: "700" },
  emptyListContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyListText: { fontSize: 16, color: COLORS.textDim },
  userCard: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 2, // Add a permanent border width
    borderColor: 'transparent', // Make it transparent by default
    overflow: "hidden",
  },
  summaryCard: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  floatingIconsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    zIndex: 50,
    backgroundColor: COLORS.surfaceLight, // A very light grey to lift it off the main background
    padding: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  miniFloatingButton: { flex: 1, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  scrollToTopButton: { position: 'absolute', bottom: 20, right: 20, width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, zIndex: 100 },
  userStatus: { fontSize: 12 },
  userCardBadge: { backgroundColor: COLORS.danger, borderRadius: 6, paddingHorizontal: 4, marginLeft: 4 },
  userCardBadgeText: { color: COLORS.textWhite, fontSize: 10 },

  /* --- Reports Module --- */
  reportsHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 12 },
  rangeSelectorContainer: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: COLORS.borderLighter,
    alignItems: 'center',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeButtonActive: { backgroundColor: COLORS.primary, elevation: 2, shadowColor: COLORS.shadow, shadowOpacity: 0.15, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  rangeText: { fontWeight: "600", color: COLORS.text },
  rangeTextActive: { color: COLORS.textWhite },
  downloadButton: {
    backgroundColor: COLORS.primary,
    padding: 10,
    borderRadius: 8,
  },
  reportSummary: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16, paddingHorizontal: 4 },
  noDataContainer: { alignItems: 'center', justifyContent: 'center', height: 200, width: '100%' },
  noDataText: { color: COLORS.textLight, marginTop: 12, fontSize: 14, fontWeight: '500' },
  headerRightContainer: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { padding: 4 },
  warningIconContainer: { marginRight: 8 },
  cardContent: { backgroundColor: COLORS.surface, paddingVertical: 8 },
  cardContentPadding: { backgroundColor: COLORS.surface, padding: 8 },
  chartRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 16 },
  chartWrapper: { justifyContent: 'center', alignItems: 'center' },
  noDataIcon: { marginBottom: 4 },
  noDataLabel: { fontSize: 14, color: COLORS.textLight },
  centeredChart: { alignItems: 'center' },
  violatorRowLabelContainer: { width: 100, justifyContent: 'center', marginRight: 8 },
  violatorLabel: { width: '100%', marginBottom: 2, marginRight: 0 },
  violatorSubLabel: { fontSize: 10, color: COLORS.danger, fontWeight: '600' },
  chevronIcon: { marginLeft: 4 },
  boldText: { fontWeight: 'bold' },

  /* --- Modal --- */
  modalBackdrop: { flex: 1, backgroundColor: COLORS.backdrop, justifyContent: "center", alignItems: "center" },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, width: "90%", height: "80%", shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalCloseBtn: { position: "absolute", top: 8, right: 8, justifyContent: "center", alignItems: "center" },
  modalHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, paddingBottom: 12 },
  modalUserName: { fontSize: 20, fontWeight: 'bold' },
  modalStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: 'flex-start', marginTop: 4 },
  modalStatusBadgeText: { color: COLORS.textWhite, fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  modalButton: { flexDirection: 'row', flex: 1, padding: 12, borderRadius: 8, justifyContent: "center", alignItems: "center", gap: 8 },
  modalButtonText: { color: COLORS.textWhite, fontWeight: "700" },
  modalInfoGrid: { marginBottom: 16 },
  modalGridRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  modalGridTitle: { fontWeight: "600" },
  modalGridValue: { color: COLORS.textSecondary },
  modalSection: { marginTop: 8 },
  modalSectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, paddingBottom: 4 },
  modalListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, padding: 8, borderRadius: 6, marginBottom: 6 },
  modalListItemText: { fontSize: 14, color: COLORS.text },
  modalActions: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 16, marginTop: 8 },
  listOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  durationSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  durationButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.borderLighter, alignItems: 'center', marginHorizontal: 4 },
  durationButtonSelected: { backgroundColor: COLORS.primary, shadowColor: COLORS.shadow, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2 },
  durationButtonText: { fontWeight: '600', color: COLORS.text, fontSize: 12 },
  durationButtonTextSelected: { color: COLORS.textWhite },
  reasonInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
    fontSize: 14,
  },

  /* --- Quick Actions --- */
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  quickActionBtn: {
    alignItems: 'center',
    flex: 1,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  /* --- Log Details --- */
  logDetailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  logDetailLabel: { width: 80, color: COLORS.textTertiary, fontWeight: '500' },
  logDetailValue: { flex: 1, color: COLORS.text },

  /* --- Log Filters --- */
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 1,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonInactive: {
    backgroundColor: COLORS.borderLighter,
    borderColor: COLORS.borderDark,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterButtonTextActive: {
    color: COLORS.textWhite,
  },
  filterButtonTextInactive: {
    color: COLORS.textSecondary,
  },

  /* --- Custom Alert --- */
  alertBackdrop: { flex: 1, backgroundColor: COLORS.alertBackdrop, justifyContent: 'center', alignItems: 'center' },
  alertContainer: { width: '85%', backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  alertTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  alertMessage: { fontSize: 15, color: COLORS.text, marginBottom: 20, lineHeight: 22 },
  alertButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  alertButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  alertButtonDefault: { backgroundColor: COLORS.primary },
  alertButtonCancel: { backgroundColor: COLORS.borderDark },
  alertButtonDestructive: { backgroundColor: COLORS.danger },
  alertButtonTextDefault: { color: COLORS.textWhite, fontWeight: 'bold' },
  alertButtonTextCancel: { color: COLORS.text, fontWeight: 'bold' },
  alertButtonTextDestructive: { color: COLORS.textWhite, fontWeight: 'bold' },

  /* --- Modal Search --- */
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.borderLighter,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  modalSearchIcon: {
    marginRight: 8,
  },
  modalSearchInput: {
    flex: 1,
    height: 40,
    color: COLORS.text,
  },

  /* --- Toast --- */
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    borderRadius: 12,
    elevation: 6,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 10000,
  },
  toastBlurWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  toastText: {
    color: COLORS.textWhite,
    fontSize: 16,
    fontWeight: '600',
  },

  trashButton: { padding: 4 },
});
