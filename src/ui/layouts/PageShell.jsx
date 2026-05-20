import './PageShell.css';

export default function PageShell({
    children,
    size = 'default',
    className = '',
    as: Component = 'div', // eslint-disable-line no-unused-vars
}) {
    const classes = ['page-shell', `page-shell--${size}`, className]
        .filter(Boolean)
        .join(' ');
    return <Component className={classes}>{children}</Component>;
}
