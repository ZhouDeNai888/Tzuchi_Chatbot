import React from 'react';

export default function ModelSettingLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <section className="flex-1 overflow-y-auto">
            {children}
        </section>
    );
}