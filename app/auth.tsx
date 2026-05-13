import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View, Modal, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import * as SecureStore from "expo-secure-store";
import Logo from "../assets/logo.png";
import { API_BASE_URL } from '../lib/apiConfig';

export default function AuthScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | ''>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [suspensionDetails, setSuspensionDetails] = useState<{ message: string; reason?: string; endDate?: string } | null>(null);

  const BASE_URL = API_BASE_URL;


  // const clearInputs = () => {
  //   setUsername('');
  //   setPassword('');
  // };

  const passwordRules = [
    { test: (pwd: string) => pwd.length >= 8, message: "At least 8 characters" },
    { test: (pwd: string) => /[A-Z]/.test(pwd), message: "Include an uppercase letter" },
    { test: (pwd: string) => /[0-9]/.test(pwd), message: "Include a number" },
    { test: (pwd: string) => /[!@#$%^&*_]/.test(pwd), message: "Include a special character (!@#$%^&*_)" },
  ];

  useEffect(() => {
    const checkLogin = async () => {
      const savedUser = await SecureStore.getItemAsync("user");

      if (savedUser) {
        const parsed = JSON.parse(savedUser);

        if (parsed.role === 'superadmin') {
          router.replace('/sadmindashboard');
        } else {
          router.replace('/home');
        }
      }
    };

    checkLogin();
  }, []);


  const handleRegister = async () => {
    if (!username) {
      setMessage("Please enter a username.");
      setMessageType('error');
      return;
    }

    const failedRules = passwordRules.filter(r => !r.test(password));
    if (failedRules.length > 0) {
      setMessage("Password does not meet requirements. See rules above.");
      setMessageType('error');
      return;
    }

    try {
      const res = await axios.post(`${BASE_URL}/register.php`,
        { username, password },
        { headers: { "Content-Type": "application/json" } }
      );

      if (res?.data?.status === 'success') {
        setMessage("Registered successfully! You can now log in.");
        setMessageType('success');
        // clearInputs();
      } else {
        setMessage(res?.data?.message || "Registration failed. Username may already exist.");
        setMessageType('error');
        // clearInputs();
      }
    } catch (err: any) {
      setMessage("Login failed. Please try again.");
      setMessageType('error');

      if (err.response) {
        console.log("📡 Server responded with:", err.response.data);
        console.log("Status:", err.response.status);
      } else if (err.request) {
        console.log("❌ No response received:", err.request);
      } else {
        console.log("⚠️ Error setting up request:", err.message);
      }
    }

  };

  const handleLogin = async () => {
    if (!username || !password) {
      setMessage("Please enter both username and password.");
      setMessageType('error');
      return;
    }

    try {
      const res = await axios.post(
        `${BASE_URL}/login.php`,
        { username, password },
        { headers: { "Content-Type": "application/json" } }
      );

      console.log("Login response:", res.data);

      if (res?.data?.success) {
        const { id, role } = res.data.user;

        // ✅ Save session (local)
        await AsyncStorage.multiSet([
          ['userID', id.toString()],
          ['username', username],
          ['role', role],
        ]);

        // ✅ Save secure session
        await SecureStore.setItemAsync(
          "user",
          JSON.stringify({ id, username, role })
        );

        setShowWelcome(true);

        setTimeout(() => {
          // 🔀 ROLE-BASED ROUTING
          if (role === 'superadmin') {
            router.replace('/sadmindashboard');
          } else {
            router.replace('/home');
          }
        }, 1500);

      } else if (res?.data?.status === 'suspended') {
        setSuspensionDetails({
          message: res?.data?.message || "Your account is suspended.",
          reason: res?.data?.reason,
          endDate: res?.data?.end_date
        });
      } else {
        setMessage(res?.data?.message || "Incorrect username or password.");
        setMessageType('error');
      }

    } catch (err) {
      setMessage("Login failed. Please try again.");
      setMessageType('error');
      console.log(err);
    }
  };

  if (showWelcome) {
    return (
      <View style={styles.container}>
        <Animated.Text
          entering={FadeIn.duration(800)}
          exiting={FadeOut.duration(800)}
          style={styles.welcomeText}
        >
          Welcome, {username}!
        </Animated.Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={Logo} style={styles.logo} />

      <TextInput
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        style={styles.input}
      />

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={styles.inputFlex}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.icon}>
          <Ionicons
            name={showPassword ? "eye-off" : "eye"}
            size={20}
            color="gray"
          />
        </TouchableOpacity>
      </View>

      {password.length > 0 && (
        <View style={styles.passwordHintContainer}>
          {passwordRules.map((rule, index) => {
            const passed = rule.test(password);
            return (
              <Text
                key={index}
                style={{
                  color: passed ? 'green' : 'red',
                  fontSize: 12,
                }}
              >
                {passed ? '✔️' : '❌'} {rule.message}
              </Text>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>LOGIN</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleRegister}>
        <Text style={styles.buttonText}>REGISTER</Text>
      </TouchableOpacity>

      {message ? (
        <Animated.View
          entering={FadeIn.duration(500)}
          exiting={FadeOut.duration(500)}
          style={{ width: '80%', marginTop: 10 }}
        >
          <Text
            style={[
              styles.message,
              messageType === 'success' ? styles.success : styles.error,
            ]}
          >
            {message}
          </Text>
        </Animated.View>
      ) : null}

      {/* Suspension Modal */}
      <Modal
        transparent
        visible={!!suspensionDetails}
        animationType="fade"
        onRequestClose={() => setSuspensionDetails(null)}
      >
        <Pressable style={styles.alertBackdrop} onPress={() => setSuspensionDetails(null)}>
          <Pressable style={{ width: '85%' }}>
            <Animated.View entering={FadeIn.duration(200)} style={styles.suspensionCard}>
              <View style={styles.suspensionHeader}>
                <Ionicons name="ban" size={48} color="#fff" />
                <Text style={styles.suspensionTitle}>Account Suspended</Text>
              </View>
              
              <View style={styles.suspensionContent}>
                <View style={styles.suspensionRow}>
                  <Text style={styles.suspensionLabel}>User:</Text>
                  <Text style={styles.suspensionValue}>{username}</Text>
                </View>
                {suspensionDetails?.reason ? (
                  <View style={styles.suspensionRow}>
                    <Text style={styles.suspensionLabel}>Reason:</Text>
                    <Text style={styles.suspensionValue}>{suspensionDetails.reason}</Text>
                  </View>
                ) : null}
                {suspensionDetails?.endDate ? (
                  <View style={styles.suspensionRow}>
                    <Text style={styles.suspensionLabel}>Ends:</Text>
                    <Text style={styles.suspensionValue}>{suspensionDetails.endDate}</Text>
                  </View>
                ) : null}
                <Text style={styles.suspensionMessage}>{suspensionDetails?.message}</Text>
              </View>

              <TouchableOpacity
                style={styles.suspensionButton}
                onPress={() => setSuspensionDetails(null)}
              ><Text style={styles.suspensionButtonText}>Close</Text></TouchableOpacity>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffa600ac'
  },
  logo: { width: 250, height: 250, resizeMode: 'contain', marginBottom: 10 },
  input: { width: '80%', borderWidth: 1, marginBottom: 10, padding: 8, borderRadius: 5, backgroundColor: '#f0f0f0' },
  inputContainer: { width: '80%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 5, backgroundColor: '#f0f0f0', marginBottom: 10, paddingHorizontal: 8 },
  inputFlex: { flex: 1, padding: 8 },
  icon: { padding: 8 },
  passwordHintContainer: { width: '80%', marginBottom: 10 },
  button: { width: '80%', backgroundColor: '#2196F3', padding: 12, borderRadius: 5, alignItems: 'center', marginVertical: 5 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  message: { fontWeight: 'bold', fontSize: 16, textAlign: 'center' },
  success: { color: 'green' },
  error: { color: 'red' },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  
  // Suspension Modal Styles
  alertBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  suspensionCard: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  suspensionHeader: { backgroundColor: '#E74C3C', paddingVertical: 20, alignItems: 'center', justifyContent: 'center' },
  suspensionTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 8 },
  suspensionContent: { padding: 20 },
  suspensionRow: { flexDirection: 'row', marginBottom: 8 },
  suspensionLabel: { fontWeight: 'bold', color: '#555', width: 70 },
  suspensionValue: { flex: 1, color: '#333' },
  suspensionMessage: { marginTop: 12, fontSize: 14, color: '#666', fontStyle: 'italic', textAlign: 'center' },
  suspensionButton: { backgroundColor: '#333', padding: 15, alignItems: 'center' },
  suspensionButtonText: { color: '#fff', fontWeight: 'bold' },
});
