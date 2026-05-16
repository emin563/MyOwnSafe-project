<div align="center">
  <img src="./assets/images/banner.png" alt="Vault Banner" width="100%" />

  # Vault - Document Archive
  **A secure, privacy-first digital vault for your most important documents.**

  [![Expo](https://img.shields.io/badge/Expo-54.0-000020?logo=expo&logoColor=white)](https://expo.dev)
  [![React Native](https://img.shields.io/badge/React_Native-0.81.5-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
  [![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-green)](https://expo.dev)
  [![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

## 🌟 Overview

Vault is a powerful document management application designed for high security and offline privacy. It allows users to scan, archive, and manage documents, receipts, and warranties with ease. Everything is stored locally on your device, ensuring your data never leaves your control.

## ✨ Key Features

- **📸 High-Performance Scanner**: Capture crisp document scans using advanced ML Kit processing.
- **🔍 OCR Extraction**: Automatically extract text from scanned documents for easy indexing.
- **📄 PDF Management**: Generate, view, and organize PDFs within the app.
- **🔐 App Locking**: Secure your archive with biometric or pin-based app locking.
- **🏷️ Global Tagging**: Organize your archive with a color-coded tag management system.
- **🛡️ Privacy-First**: Completely offline operation—your documents stay on your device.
- **🔔 Expiry Notifications**: Never miss a warranty or document expiry with intelligent alerts.

## 🛠️ Technical Stack

- **Framework**: [Expo](https://expo.dev/) (SDK 54) & [React Native](https://reactnative.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Database**: [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Storage**: [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/secure-store/)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Native Modules**: 
  - `react-native-worklets` for high-performance background tasks.
  - `expo-camera` for document capture.
  - `react-native-pdf` for seamless viewing.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Expo Go](https://expo.dev/go) or an Android/iOS Development Build
- (Windows Users) Ensure your Android SDK is on an ASCII-only path.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/vault-document-archive.git
   cd vault-document-archive
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy the example environment file and add your keys:
   ```bash
   cp .env.example .env
   ```

4. **Start the Development Server**
   ```bash
   npm run start
   ```

## 🏗️ Development Builds

### Android (Local)
To build a local development APK:
```bash
npx expo run:android
```

### iOS (Local)
```bash
npx expo run:ios
```

---

<p align="center">
  Made with ❤️ by <b>Gundogdu</b>
</p>
