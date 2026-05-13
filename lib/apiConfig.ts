// lib/apiConfig.ts
import { Platform } from 'react-native';

// --- Centralized API Configuration ---

// Replace with your computer's local IP address.
const PC_LOCAL_IP = "CHANGE_THIS_TO_YOUR_IP";

// The base URL for your backend API.
// It uses the local IP for Android development and 'localhost' for others (like web).
export const API_BASE_URL = Platform.OS === 'android'
  ? `http://${PC_LOCAL_IP}/ChatKita-NNM`
  : `http://localhost/ChatKita-NNM`;
