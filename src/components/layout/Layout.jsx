import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import SettingsModal from '../modals/SettingsModal';
import Footer from './Footer';

export default function Layout() {
  return (
    <div id="layout" className="min-h-screen bg-dashboard-bg flex flex-col">
      <Header />
      <main className="flex-1 max-w-[1920px] w-full mx-auto px-6 py-6">
        <Outlet />
      </main>
      <Footer />
      <SettingsModal />
    </div>
  );
}
