# Parallel `./configure`

<div class="infobar">

*fa-clock-o* *time-2025-04-25*
*fa-user* Tavian Barnes
[*fa-github* GitHub](https://github.com/tavianator/parconf)

</div>

I'm sorry, but in the year 2025, this is ridiculous:

<style>
pre code .scroll {
    height: 1lh;
    overflow: hidden;
}
pre code .scroll .config-output {
    animation: scroll 38.018s steps(775, jump-none) forwards;
}
pre code .scroll .make-output {
    animation: scroll 2.822s steps(404, jump-none) 38.018s forwards;
}
@keyframes scroll {
    0% {
        transform: translateY(0%);
    }
    100% {
        transform: translateY(calc(1lh - 100%));
    }
}
</style>
<pre>
<code>$ time ./configure
<div class="scroll"><div class="config-output">checking for a BSD-compatible install... /usr/bin/install -c
checking whether sleep supports fractional seconds... yes
checking filesystem timestamp resolution... 0.01
checking whether build environment is sane... yes
checking for a race-free mkdir -p... /usr/bin/mkdir -p
checking for gawk... gawk
checking whether make sets $(MAKE)... yes
checking whether make supports nested variables... yes
checking xargs -n works... yes
checking build system type... x86_64-pc-linux-gnu
checking host system type... x86_64-pc-linux-gnu
checking for leaf optimisation... yes
checking for gcc... gcc
checking whether the C compiler works... yes
checking for C compiler default output file name... a.out
checking for suffix of executables... 
checking whether we are cross compiling... no
checking for suffix of object files... o
checking whether the compiler supports GNU C... yes
checking whether gcc accepts -g... yes
checking for gcc option to enable C11 features... none needed
checking whether gcc understands -c and -o together... yes
checking whether the compiler is clang... no
checking for compiler option needed when checking for declarations... none
checking whether make supports the include directive... yes (GNU style)
checking dependency style of gcc... gcc3
checking how to run the C preprocessor... gcc -E
checking for grep that handles long lines and -e... /usr/bin/grep
checking for egrep... /usr/bin/grep -E
checking for stdio.h... yes
checking for stdlib.h... yes
checking for string.h... yes
checking for inttypes.h... yes
checking for stdint.h... yes
checking for strings.h... yes
checking for sys/stat.h... yes
checking for sys/types.h... yes
checking for unistd.h... yes
checking for wchar.h... yes
checking for minix/config.h... no
checking for stdbool.h... yes
checking for byteswap.h... yes
checking for uchar.h... yes
checking for sys/param.h... yes
checking for sys/socket.h... yes
checking for dirent.h... yes
checking for endian.h... yes
checking for sys/endian.h... no
checking for error.h... yes
checking for fnmatch.h... yes
checking for stdio_ext.h... yes
checking for sys/vfs.h... yes
checking for netdb.h... yes
checking for getopt.h... yes
checking for sys/time.h... yes
checking for threads.h... yes
checking for limits.h... yes
checking for crtdefs.h... no
checking for wctype.h... yes
checking for langinfo.h... yes
checking for xlocale.h... no
checking for math.h... yes
checking for sys/mman.h... yes
checking for sys/statvfs.h... yes
checking for pthread.h... yes
checking for malloc.h... yes
checking for selinux/selinux.h... no
checking for stdckdint.h... yes
checking for sys/uio.h... yes
checking for sys/utsname.h... yes
checking for sys/wait.h... yes
checking for features.h... yes
checking for arpa/inet.h... yes
checking for netinet/in.h... yes
checking for semaphore.h... yes
checking for priv.h... no
checking for sys/select.h... yes
checking for sys/ioctl.h... yes
checking for sys/random.h... yes
checking for sys/un.h... yes
checking whether it is safe to define __EXTENSIONS__... yes
checking whether _XOPEN_SOURCE should be defined... no
checking for egrep -e... (cached) /usr/bin/grep -E
checking for Minix Amsterdam compiler... no
checking for ar... ar
checking for ranlib... ranlib
checking for gcc option to support large files... none needed
checking for gcc option to support timestamps after 2038... none needed
checking whether ln -s works... yes
checking whether make sets $(MAKE)... (cached) yes
checking for gcc option to support large files... (cached) none needed
checking for gcc option to support timestamps after 2038... (cached) none needed
checking for lstat... yes
checking for btowc... yes
checking for mbrtowc... yes
checking for mbsinit... yes
checking for canonicalize_file_name... yes
checking for realpath... yes
checking for _set_invalid_parameter_handler... no
checking for fchdir... yes
checking for fdopendir... yes
checking for fcntl... yes
checking for symlink... yes
checking for fnmatch... yes
checking for mbsrtowcs... yes
checking for fpurge... no
checking for fstatat... yes
checking for openat... yes
checking for fstatfs... yes
checking for getdtablesize... yes
checking for getexecname... no
checking for gettimeofday... yes
checking for isblank... yes
checking for iswcntrl... yes
checking for mbslen... no
checking for isascii... yes
checking for mprotect... yes
checking for strftime_z... no
checking for __xpg_strerror_r... yes
checking for pipe... yes
checking for qsort_r... yes
checking for readlink... yes
checking for iswctype... yes
checking for setenv... yes
checking for snprintf... yes
checking for strndup... yes
checking for strtoumax... yes
checking for localtime_r... yes
checking for unlinkat... yes
checking for vasnprintf... no
checking for wcrtomb... yes
checking for wcwidth... yes
checking for geteuid... yes
checking for pselect... yes
checking for pthread_sigmask... yes
checking for secure_getenv... yes
checking for getuid... yes
checking for getgid... yes
checking for getegid... yes
checking for sleep... yes
checking for shutdown... yes
checking for usleep... yes
checking for wctob... yes
checking for vprintf... yes
checking for size_t... yes
checking for working alloca.h... yes
checking for alloca... yes
checking whether the preprocessor supports include_next... yes
checking whether source code line length is unlimited... yes
checking for wint_t... yes
checking whether wint_t is large enough... yes
checking whether &lt;wchar.h&gt; uses 'inline' correctly... yes
checking for nl_langinfo and CODESET... yes
checking for a traditional french locale... none
checking whether char8_t is correctly defined... yes
checking whether char16_t is correctly defined... yes
checking whether char32_t is correctly defined... yes
checking for bit size of wchar_t... 32
checking for mbstate_t... yes
checking for a traditional japanese locale... none
checking for an english Unicode locale... en_US.UTF-8
checking for a transitional chinese locale... none
checking whether mbrtowc handles incomplete characters... yes
checking whether mbrtowc works as well as mbtowc... guessing yes
checking for gcc options needed to detect all undeclared functions... none needed
checking whether mbrtoc32 is declared... yes
checking for mbrtoc32... yes
checking whether mbrtoc32 works as well as mbrtowc... guessing yes
checking whether c32rtomb is declared... yes
checking for c32rtomb... yes
checking whether c32rtomb works as well as wcrtomb... guessing yes
checking whether malloc is ptrdiff_t safe... yes
checking whether malloc, realloc, calloc set errno on failure... yes
checking whether lstat correctly handles trailing slash... yes
checking whether // is distinct from /... no
checking whether realpath works... yes
checking for C/C++ restrict keyword... __restrict__
checking whether byte ordering is bigendian... no
checking if endian.h defines stdint types... no
checking if endian.h defines functions and macros... yes
checking if environ is properly declared... yes
checking for complete errno.h... yes
checking for error... yes
checking whether error_at_line is declared... yes
checking for error_at_line... yes
checking for working error function... yes
checking whether strerror_r is declared... yes
checking whether strerror_r returns char *... yes
checking for uid_t... yes
checking for gid_t... yes
checking type of array argument to getgroups... gid_t
checking whether ctype.h defines __header_inline... no
checking whether fchdir is declared... yes
checking for working fcntl.h... yes
checking for pid_t... yes
checking for mode_t... yes
checking for promoted mode_t type... mode_t
checking whether strmode is declared... no
checking whether fopen recognizes a trailing slash... yes
checking whether fflush works on input streams... no
checking whether stdin defaults to large file offsets... yes
checking for off64_t... yes
checking whether fseeko is declared... yes
checking for fseeko... yes
checking whether fflush works on input streams... (cached) no
checking whether stat file-mode macros are broken... no
checking for nlink_t... yes
checking whether ftello is declared... yes
checking whether ungetc works on arbitrary bytes... yes
checking for ftello... yes
checking whether ftello works... yes
checking for O_CLOEXEC... yes
checking whether getcwd (NULL, 0) allocates memory for result... yes
checking for getcwd with POSIX signature... yes
checking whether getcwd is declared... yes
checking whether alarm is declared... yes
checking whether getdelim is declared... yes
checking whether getdtablesize is declared... yes
checking whether getline is declared... yes
checking for getopt.h... (cached) yes
checking for getopt_long_only... yes
checking whether getopt is POSIX compatible... yes
checking for working GNU getopt function... yes
checking for working GNU getopt_long function... yes
checking for glibc-compatible sys/cdefs.h... yes
checking whether timespec_get is declared... yes
checking for timespec_get... yes
checking for struct timeval... yes
checking for wide-enough struct timeval.tv_sec member... yes
checking for pthread.h... (cached) yes
checking for pthread_kill in -lpthread... yes
checking whether POSIX threads API is available... yes
checking whether setlocale (LC_ALL, NULL) is multithread-safe... yes
checking whether setlocale (category, NULL) is multithread-safe... yes
checking for inline... inline
checking whether limits.h has WORD_BIT, BOOL_WIDTH etc.... yes
checking whether limits.h has SSIZE_MAX... yes
checking whether the compiler produces multi-arch binaries... no
checking whether stdint.h conforms to C99... yes
checking whether stdint.h works without ISO C predefines... yes
checking whether stdint.h has UINTMAX_WIDTH etc.... yes
checking whether INT32_MAX &lt; INTMAX_MAX... yes
checking whether INT64_MAX == LONG_MAX... yes
checking whether UINT32_MAX &lt; UINTMAX_MAX... yes
checking whether UINT64_MAX == ULONG_MAX... yes
checking where to find the exponent in a 'long double'... word 2 bit 0
checking whether long double and double are the same... no
checking where to find the exponent in a 'double'... word 1 bit 20
checking where to find the exponent in a 'float'... word 0 bit 23
checking whether iswcntrl works... yes
checking for towlower... yes
checking for wctype_t... yes
checking for wctrans_t... yes
checking whether wctype supports the "blank" and "punct" character classes... yes
checking whether langinfo.h defines CODESET... yes
checking whether langinfo.h defines T_FMT_AMPM... yes
checking whether langinfo.h defines ALTMON_1... yes
checking whether langinfo.h defines ERA... yes
checking whether langinfo.h defines YESEXPR... yes
checking for good max_align_t... yes
checking whether NULL can be used in arbitrary expressions... yes
checking for unreachable... no
checking whether nullptr_t needs &lt;stddef.h&gt;... no
checking for clean definition of __STDC_VERSION_STDDEF_H__... yes
checking whether locale.h defines locale_t... yes
checking whether locale.h conforms to POSIX:2001... yes
checking whether struct lconv is properly defined... yes
checking for LC_MESSAGES... yes
checking for uselocale... yes
checking whether uselocale works... yes
checking for fake locale system (OpenBSD)... no
checking for Solaris 11.4 locale system... no
checking for getlocalename_l... no
checking whether imported symbols can be declared weak... yes
checking for multithread API to use... posix
checking for a sed that does not truncate output... /usr/bin/sed
checking whether malloc (0) returns nonnull... yes
checking whether NAN macro works... yes
checking whether HUGE_VAL works... yes
checking for mmap... yes
checking for MAP_ANONYMOUS... yes
checking whether memchr works... yes
checking whether memrchr is declared... yes
checking whether &lt;limits.h&gt; defines MIN and MAX... no
checking whether &lt;sys/param.h&gt; defines MIN and MAX... yes
checking whether time_t is signed... yes
checking for working mktime... yes
checking whether trunc is declared... yes
checking for struct tm.tm_gmtoff... yes
checking for struct tm.tm_zone... yes
checking for compound literals... yes
checking whether strerror(0) succeeds... yes
checking for strerror_r... yes
checking for strerror_r with POSIX signature... no
checking whether __xpg_strerror_r works... yes
checking for pthread_t... yes
checking for pthread_spinlock_t... yes
checking for pthread_spin_init... yes
checking whether realloc should abort upon undefined behaviour... no
checking for ssize_t... yes
checking for sched.h... yes
checking for struct sched_param... yes
checking for library containing setfilecon... no
checking whether setenv is declared... yes
checking whether _putenv is declared... no
checking for search.h... yes
checking for tsearch... yes
checking whether snprintf returns a byte count as in C99... yes
checking whether printf supports POSIX/XSI format strings with positions... yes
checking whether snprintf is declared... yes
checking for library containing setsockopt... none needed
checking whether fcloseall is declared... yes
checking whether getw is declared... yes
checking whether putw is declared... yes
checking which flavor of printf attribute matches inttypes macros... system
checking whether ecvt is declared... yes
checking whether fcvt is declared... yes
checking whether gcvt is declared... yes
checking whether MB_CUR_MAX is correct... yes
checking for strcasestr... yes
checking whether strcasestr works... yes
checking whether strdup is declared... yes
checking whether strndup is declared... yes
checking whether strnlen is declared... yes
checking whether strstr works... yes
checking whether strtoumax is declared... yes
checking whether &lt;sys/socket.h&gt; is self-contained... yes
checking for shutdown... (cached) yes
checking whether &lt;sys/socket.h&gt; defines the SHUT_* macros... yes
checking for struct sockaddr_storage... yes
checking for sa_family_t... yes
checking for struct sockaddr_storage.ss_family... yes
checking for struct utsname... yes
checking for struct timespec in &lt;time.h&gt;... yes
checking for TIME_UTC in &lt;time.h&gt;... yes
checking whether execvpe is declared... yes
checking whether clearerr_unlocked is declared... yes
checking whether feof_unlocked is declared... yes
checking whether ferror_unlocked is declared... yes
checking whether fflush_unlocked is declared... yes
checking whether fgets_unlocked is declared... yes
checking whether fputc_unlocked is declared... yes
checking whether fputs_unlocked is declared... yes
checking whether fread_unlocked is declared... yes
checking whether fwrite_unlocked is declared... yes
checking whether getc_unlocked is declared... yes
checking whether getchar_unlocked is declared... yes
checking whether putc_unlocked is declared... yes
checking whether putchar_unlocked is declared... yes
checking whether unsetenv is declared... yes
checking for inttypes.h... yes
checking for stdint.h... yes
checking for intmax_t... yes
checking whether snprintf truncates the result as in C99... yes
checking for wcslen... yes
checking for snprintf... (cached) yes
checking for strnlen... yes
checking for wcrtomb... (cached) yes
checking whether _snprintf is declared... no
checking whether wcsdup is declared... yes
checking for C compiler option to allow warnings... -Wno-error
checking for a french Unicode locale... none
checking for a turkish Unicode locale... none
checking for IPv4 sockets... yes
checking for IPv6 sockets... yes
checking for off_t... yes
checking for CFPreferencesCopyAppValue... no
checking for CFLocaleCopyPreferredLanguages... no
checking for library needed for semaphore functions... none
checking whether &lt;sys/select.h&gt; is self-contained... yes
checking for sigset_t... yes
checking whether initstate is declared... yes
checking whether setstate is declared... yes
checking for volatile sig_atomic_t... yes
checking for sighandler_t... yes
checking whether ldexp() can be used without linking with libm... yes
checking whether &lt;sys/ioctl.h&gt; declares ioctl... yes
checking whether access honors trailing slash... yes
checking for alignas and alignof... yes, &lt;stdalign.h&gt; macros
checking for alloca as a compiler built-in... yes
checking whether to enable assertions... yes
checking for static_assert... yes, an &lt;assert.h&gt; macro
checking for bool, true, false... no
checking whether btowc(0) is correct... yes
checking whether btowc(EOF) is correct... guessing yes
checking whether btowc is consistent with mbrtowc in the C locale... no
checking for __builtin_expect... yes
checking for working bswap_16, bswap_32, bswap_64... yes
checking whether calloc (0, n) and calloc (n, 0) return nonnull... yes
checking for faccessat... yes
checking for readlinkat... yes
checking whether this system supports file names of any length... no
checking for library containing clock_gettime... none required
checking for clock_getres... yes
checking for clock_gettime... yes
checking for clock_settime... yes
checking for closedir... yes
checking for d_ino member in directory struct... yes
checking for d_type member in directory struct... yes
checking for dirfd... yes
checking whether dirfd is declared... yes
checking whether dirfd is a macro... no
checking whether // is distinct from /... (cached) no
checking whether dup works... yes
checking whether dup2 works... yes
checking for euidaccess... yes
checking for faccessat... (cached) yes
checking whether fcntl handles F_DUPFD correctly... yes
checking whether fcntl understands F_DUPFD_CLOEXEC... needs runtime check
checking whether fdopendir is declared... yes
checking whether fdopendir works... yes
checking whether fflush works on input streams... (cached) no
checking for struct stat.st_blocks... yes
checking for mempcpy... yes
checking for flexible array member... yes
checking whether float.h conforms to ISO C23... no
checking whether conversion from 'int' to 'long double' works... yes
checking for working GNU fnmatch... yes
checking whether fopen supports the mode character 'x'... yes
checking whether fopen supports the mode character 'e'... yes
checking for __fpending... yes
checking whether __fpending is declared... yes
checking for __fpurge... yes
checking whether fpurge is declared... no
checking for __freadahead... no
checking for __freading... yes
checking whether free is known to preserve errno... yes
checking for fseeko... (cached) yes
checking whether fflush works on input streams... (cached) no
checking for _fseeki64... no
checking whether fstatat (..., 0) works... yes
checking for ftello... (cached) yes
checking whether ftello works... (cached) yes
checking for struct statfs.f_type... yes
checking for __fsword_t... yes
checking for fts_open... yes
checking whether getcwd handles long file names properly... yes
checking whether getcwd succeeds when 4k &lt; cwd_length &lt; 16k... yes
checking for getdelim... yes
checking for working getdelim function... yes
checking whether getdtablesize works... yes
checking for getgroups... yes
checking for working getgroups... yes
checking whether getgroups handles negative values... yes
checking for gethostname... yes
checking for HOST_NAME_MAX... yes
checking for getline... yes
checking for working getline function... yes
checking for getprogname... no
checking whether program_invocation_name is declared... yes
checking whether program_invocation_name is declared... (cached) yes
checking whether program_invocation_short_name is declared... yes
checking whether __argv is declared... no
checking for gettimeofday with POSIX signature... yes
checking for group_member... yes
checking whether the compiler generally respects inline... yes
checking whether isfinite is declared... yes
checking whether isfinite(long double) works... yes
checking whether isinf is declared... yes
checking whether isinf(long double) works... yes
checking whether isnan(double) can be used without linking with libm... yes
checking whether isnan(float) can be used without linking with libm... yes
checking whether isnan(float) works... yes
checking whether isnan(long double) can be used without linking with libm... yes
checking whether isnanl works... yes
checking for iswblank... yes
checking whether iswblank is declared... yes
checking whether iswdigit is ISO C compliant... yes
checking whether iswpunct is consistent with ispunct... yes
checking whether iswxdigit is ISO C compliant... yes
checking whether the compiler supports the __inline keyword... yes
checking whether localeconv works... yes
checking for pthread_rwlock_t... yes
checking whether pthread_rwlock_rdlock prefers a writer to a reader... no
checking whether lseek detects pipes... yes
checking whether SEEK_DATA works but is incompatible with GNU... no
checking whether mbrtoc32 works on empty input... yes
checking whether the C locale is free of encoding errors... no
checking whether mbrtoc32 works in an UTF-8 locale... yes
checking whether mbrtowc handles a NULL pwc argument... yes
checking whether mbrtowc handles a NULL string argument... yes
checking whether mbrtowc has a correct return value... yes
checking whether mbrtowc returns 0 when parsing a NUL character... guessing yes
checking whether mbrtowc stores incomplete characters... no
checking whether mbrtowc works on empty input... yes
checking whether the C locale is free of encoding errors... no
checking whether mbsrtowcs works... yes
checking whether the C locale is free of encoding errors... (cached) no
checking whether mbswidth is declared in &lt;wchar.h&gt;... no
checking for mbstate_t... (cached) yes
checking for mbtowc... yes
checking for mempcpy... (cached) yes
checking for memrchr... yes
checking for __mktime_internal... no
checking whether modf can be used without linking with libm... yes
checking for listmntent... no
checking for sys/ucred.h... no
checking for sys/mount.h... yes
checking for mntent.h... yes
checking for sys/fs_types.h... no
checking for struct fsstat.f_fstypename... no
checking for library containing getmntent... none required
checking for getmntent... yes
checking for mntctl function and struct vmount... no
checking for one-argument getmntent function... yes
checking for setmntent... yes
checking for endmntent... yes
checking for hasmntopt... yes
checking for sys/mntent.h... no
checking for sys/mkdev.h... no
checking for sys/sysmacros.h... yes
checking for struct statfs.f_fstypename... no
checking for nl_langinfo... yes
checking whether YESEXPR works... yes
checking whether open recognizes a trailing slash... yes
checking for opendir... yes
checking for bison... bison
checking for bison 2.4 or newer... 3.8.2, ok
checking whether perror matches strerror... yes
checking whether program_invocation_name is declared... (cached) yes
checking whether program_invocation_short_name is declared... (cached) yes
checking for PTHREAD_CREATE_DETACHED... yes
checking for PTHREAD_MUTEX_RECURSIVE... yes
checking for PTHREAD_MUTEX_ROBUST... yes
checking for PTHREAD_PROCESS_SHARED... yes
checking whether pthread_once works... yes
checking for qsort_r signature... GNU
checking for rawmemchr... yes
checking for readdir... yes
checking whether readlink signature is correct... yes
checking whether readlink handles trailing slash correctly... yes
checking whether readlink truncates results correctly... yes
checking for readlinkat... (cached) yes
checking whether readlinkat signature is correct... yes
checking whether realloc (..., 0) returns nonnull... no
checking for reallocarray... yes
checking for working re_compile_pattern... yes
checking for rewinddir... yes
checking whether rmdir works... yes
checking for rpmatch... yes
checking for selinux/flask.h... no
checking whether setenv validates arguments... yes
checking whether setlocale (LC_ALL, NULL) is multithread-safe... (cached) yes
checking whether setlocale (category, NULL) is multithread-safe... (cached) yes
checking for stdint.h... (cached) yes
checking for SIZE_MAX... yes
checking for snprintf... (cached) yes
checking whether snprintf respects a size of 1... yes
checking for socklen_t... yes
checking for ssize_t... (cached) yes
checking whether stat handles trailing slashes on files... yes
checking for struct stat.st_atim.tv_nsec... yes
checking whether struct stat.st_atim is of type struct timespec... yes
checking for struct stat.st_birthtimespec.tv_nsec... no
checking for struct stat.st_birthtimensec... no
checking for struct stat.st_birthtim.tv_nsec... no
checking for va_copy... yes
checking for stpcpy... yes
checking for strcasecmp... yes
checking for strncasecmp... yes
checking whether strncasecmp is declared... yes
checking whether strcasestr works in linear time... yes
checking for strcasestr... (cached) yes
checking whether strcasestr works... (cached) yes
checking for working strerror function... yes
checking for catgets... yes
checking for working strndup... yes
checking for working strnlen... yes
checking whether strstr works in linear time... yes
checking whether strstr works... (cached) yes
checking for strtoull... yes
checking whether strtoull works... yes
checking whether localtime_r is declared... yes
checking whether localtime_r is compatible with its POSIX signature... yes
checking whether localtime works even near extrema... yes
checking for timezone_t... no
checking for tzalloc... no
checking for timegm... yes
checking whether trunc is declared... (cached) yes
checking for uname... yes
checking whether unlink honors trailing slashes... yes
checking whether unlink of a parent directory fails as it should... guessing yes
checking for unsetenv... yes
checking for unsetenv() return type... int
checking whether unsetenv obeys POSIX... yes
checking for variable-length arrays... yes
checking for ptrdiff_t... yes
checking whether wcrtomb works in the C locale... yes
checking whether wcrtomb return value is correct... yes
checking whether wcwidth is declared... yes
checking whether wcwidth works reasonably in UTF-8 locales... yes
checking for wmemchr... yes
checking for wmempcpy... yes
checking for stdint.h... (cached) yes
checking for atoll... yes
checking whether c32rtomb return value is correct... yes
checking whether open recognizes a trailing slash... (cached) yes
checking whether fdopen sets errno... yes
checking for ftruncate... yes
checking for getrandom... yes
checking whether getrandom is compatible with its GNU+BSD signature... yes
checking for duplocale... yes
checking for library containing inet_pton... none required
checking whether inet_pton is declared... yes
checking whether byte ordering is bigendian... (cached) no
checking for ioctl... yes
checking for ioctl with POSIX signature... no
checking for newlocale... yes
checking for newlocale... (cached) yes
checking for newlocale... (cached) yes
checking for duplocale... (cached) yes
checking for freelocale... yes
checking whether mkdir handles trailing slash... yes
checking whether mkdir handles trailing dot... yes
checking for library containing nanosleep... none required
checking for working nanosleep... no (mishandles large arguments)
checking whether &lt;netinet/in.h&gt; is self-contained... yes
checking for uselocale... (cached) yes
checking whether uselocale works... (cached) yes
checking for getppriv... no
checking whether signature of pselect conforms to POSIX... yes
checking whether pselect detects invalid fds... yes
checking for pthread_mutexattr_getrobust... yes
checking for pthread_rwlock_init... yes
checking whether pthread_rwlock_timedrdlock is declared... yes
checking for reasonable pthread_rwlock wait queue handling... no
checking whether pthread_create exists as a global function... yes
checking whether pthread_mutex_timedlock is declared... yes
checking for pthread_mutex_timedlock... yes
checking whether pthread_sigmask is a macro... no
checking whether pthread_sigmask works without -lpthread... yes
checking whether pthread_sigmask returns error numbers... yes
checking whether pthread_sigmask unblocks signals correctly... guessing yes
checking for putenv compatible with GNU and SVID... yes
checking for raise... yes
checking for sigprocmask... yes
checking for random... yes
checking for initstate... yes
checking for setstate... yes
checking for random.h... no
checking for struct random_data... yes
checking for random_r... yes
checking whether sched_yield is declared... yes
checking whether select supports a 0 argument... yes
checking whether select detects invalid fds... yes
checking whether setlocale supports the C locale... yes
checking for signbit macro... yes
checking for signbit compiler built-ins... yes
checking for sigprocmask... (cached) yes
checking whether sleep is declared... yes
checking for working sleep... yes
checking whether strtod obeys C99... yes
checking for strtoll... yes
checking whether strtoll works... yes
checking whether symlink handles trailing slash correctly... yes
checking for symlinkat... yes
checking whether symlinkat handles trailing slash correctly... yes
checking for IPv4 sockets... (cached) yes
checking for IPv6 sockets... (cached) yes
checking for UNIX domain sockets... yes
checking for pthread_atfork... yes
checking for sys/single_threaded.h... yes
checking whether time() works... guessing no
checking for struct tm.tm_gmtoff... (cached) yes
checking for struct tm.tm_zone... (cached) yes
checking whether tmpfile works... yes
checking for useconds_t... yes
checking whether usleep allows large arguments... yes
checking whether wctob works... guessing yes
checking whether wctob is declared... yes
checking whether C compiler handles -Werror -Wunknown-warning-option... no
checking for getpwnam... yes
checking for modf in -lm... yes
checking for fabs in -lm... yes
checking for sys/param.h... (cached) yes
checking for mntent.h... (cached) yes
checking for sys/mnttab.h... no
checking for sys/mntio.h... no
checking for sys/mkdev.h... (cached) no
checking for getrlimit... yes
checking for sys/mkdev.h... (cached) no
checking for sys/sysmacros.h... (cached) yes
checking for dirent.h that defines DIR... yes
checking for library containing opendir... none required
checking whether stat file-mode macros are broken... (cached) no
checking for sys/wait.h that is POSIX.1 compatible... (cached) yes
checking for uid_t... (cached) yes
checking for gid_t... (cached) yes
checking for size_t... (cached) yes
checking for ssize_t... yes
checking for pid_t... (cached) yes
checking for ino_t... yes
checking for dev_t... yes
checking for mode_t... (cached) yes
checking for struct stat.st_blocks... (cached) yes
checking for struct stat.st_rdev... yes
checking for promoted mode_t type... (cached) mode_t
checking whether struct tm is in sys/time.h or time.h... time.h
checking for struct tm.tm_zone... (cached) yes
checking for strftime... yes
checking for memcmp... yes
checking for memset... yes
checking for stpcpy... (cached) yes
checking for strdup... yes
checking for strstr... yes
checking for strtol... yes
checking for strtoul... yes
checking for fchdir... (cached) yes
checking for getcwd... yes
checking for strerror... yes
checking for endgrent... yes
checking for endpwent... yes
checking for setlocale... yes
checking for getrusage... yes
checking for working alloca.h... (cached) yes
checking for alloca... (cached) yes
checking whether closedir returns void... no
checking for getmntent... (cached) yes
checking for getmntent... (cached) yes
checking for setmntent... (cached) yes
checking for endmntent... (cached) yes
checking for setgroups... yes
checking for alloca as a compiler built-in... (cached) yes
checking for working re_compile_pattern... (cached) yes
checking for sort... /usr/bin/sort
checking if /usr/bin/sort supports the -z option... yes
checking for struct dirent.d_type... yes
checking for __attribute__ ((__noreturn__)) support... yes
checking whether NLS is requested... yes
checking for msgfmt... /usr/bin/msgfmt
checking for gmsgfmt... /usr/bin/msgfmt
checking for xgettext... /usr/bin/xgettext
checking for msgmerge... /usr/bin/msgmerge
checking for ld used by gcc... /usr/bin/ld
checking if the linker (/usr/bin/ld) is GNU ld... yes
checking for shared library run path origin... done
checking 32-bit host C ABI... no
checking for ELF binary format... yes
checking for the common suffixes of directories in the library search path... lib,lib,lib64
checking for CFPreferencesCopyAppValue... (cached) no
checking for CFLocaleCopyPreferredLanguages... (cached) no
checking for GNU gettext in libc... yes
checking whether to use NLS... yes
checking where the gettext function comes from... libc
checking for python... /usr/bin/python
checking for python version... 3.13
checking for python platform... linux
checking for GNU default python prefix... ${prefix}
checking for GNU default python exec_prefix... ${exec_prefix}
checking for python script directory (pythondir)... ${PYTHON_PREFIX}/lib/python3.13/site-packages
checking for python extension module directory (pyexecdir)... ${PYTHON_EXEC_PREFIX}/lib/python3.13/site-packages
checking for faketime... no
checking that generated files are newer than configure... done
configure: creating ./config.status
config.status: creating Makefile
config.status: creating build-aux/Makefile
config.status: creating doc/Makefile
config.status: creating find/Makefile
config.status: creating find/testsuite/Makefile
config.status: creating gl/Makefile
config.status: creating gl/lib/Makefile
config.status: creating lib/Makefile
config.status: creating locate/Makefile
config.status: creating locate/testsuite/Makefile
config.status: creating m4/Makefile
config.status: creating po/Makefile.in
config.status: creating po/Makefile
config.status: creating gnulib-tests/Makefile
config.status: creating xargs/Makefile
config.status: creating xargs/testsuite/Makefile
config.status: creating config.h
config.status: config.h is unchanged
config.status: executing depfiles commands
config.status: executing po-directories commands
config.status: creating po/Makefile
</div></div>./configure  13.80s user 12.72s system 69% cpu 38.018 total
$ time make -j48
<div class="scroll"><div class="make-output">
make  all-recursive
make[1]: Entering directory '/home/tavianator/code/gnu/findutils'
Making all in gl
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/gl'
Making all in lib
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/gl/lib'
  GEN      alloca.h
  GEN      ctype.h
  GEN      endian.h
  GEN      dirent.h
  GEN      fcntl.h
  GEN      error.h
  GEN      float.h
  GEN      malloc/dynarray-skeleton.gl.h
  GEN      malloc/scratch_buffer.gl.h
  GEN      malloc/dynarray.gl.h
  GEN      inttypes.h
  GEN      langinfo.h
  GEN      limits.h
  GEN      locale.h
  GEN      math.h
  GEN      pthread.h
  GEN      sched.h
  GEN      selinux/selinux.h
  GEN      selinux/context.h
  GEN      selinux/label.h
  GEN      stddef.h
  GEN      stdio.h
  GEN      stdlib.h
  GEN      string.h
  GEN      strings.h
  GEN      sys/socket.h
  GEN      sys/stat.h
  GEN      sys/time.h
  GEN      sys/types.h
  GEN      sys/uio.h
  GEN      sys/utsname.h
  GEN      sys/wait.h
  GEN      time.h
  GEN      uchar.h
  GEN      unicase.h
  GEN      unictype.h
  GEN      uninorm.h
  GEN      unistd.h
  GEN      unistr.h
  GEN      unitypes.h
  GEN      uniwidth.h
  GEN      wchar.h
  GEN      wctype.h
make  all-recursive
make[4]: Entering directory '/home/tavianator/code/gnu/findutils/gl/lib'
make[5]: Entering directory '/home/tavianator/code/gnu/findutils/gl/lib'
  CC       libgnulib_a-allocator.o
  CC       libgnulib_a-areadlinkat.o
  CC       libgnulib_a-areadlink.o
  CC       libgnulib_a-argmatch.o
  CC       libgnulib_a-argv-iter.o
  CC       libgnulib_a-basename-lgpl.o
  CC       libgnulib_a-openat-proc.o
  CC       libgnulib_a-bitrotate.o
  CC       libgnulib_a-btoc32.o
  CC       libgnulib_a-btowc.o
  CC       libgnulib_a-c-ctype.o
  CC       libgnulib_a-c-strcasecmp.o
  CC       libgnulib_a-c-strncasecmp.o
  CC       libgnulib_a-c-strcasestr.o
  CC       libgnulib_a-c-strstr.o
  CC       libgnulib_a-c32_apply_type_test.o
  CC       libgnulib_a-c32_get_type_test.o
  CC       libgnulib_a-c32isalnum.o
  CC       libgnulib_a-c32isalpha.o
  CC       libgnulib_a-c32isblank.o
  CC       libgnulib_a-c32iscntrl.o
  CC       libgnulib_a-c32isdigit.o
  CC       libgnulib_a-c32isgraph.o
  CC       libgnulib_a-c32islower.o
  CC       libgnulib_a-c32isprint.o
  CC       libgnulib_a-c32ispunct.o
  CC       libgnulib_a-c32isspace.o
  CC       libgnulib_a-c32isupper.o
  CC       libgnulib_a-c32isxdigit.o
  CC       libgnulib_a-c32tolower.o
  CC       libgnulib_a-c32width.o
  CC       libgnulib_a-canonicalize.o
  CC       libgnulib_a-careadlinkat.o
  CC       libgnulib_a-chdir-long.o
  CC       libgnulib_a-cloexec.o
  CC       libgnulib_a-close-stream.o
  CC       libgnulib_a-closein.o
  CC       libgnulib_a-closeout.o
  CC       libgnulib_a-cycle-check.o
  CC       libgnulib_a-opendir-safer.o
  CC       libgnulib_a-dirname.o
  CC       libgnulib_a-basename.o
  CC       libgnulib_a-dirname-lgpl.o
  CC       libgnulib_a-stripslash.o
  CC       libgnulib_a-endian.o
  CC       libgnulib_a-exitfail.o
  CC       libgnulib_a-fcntl.o
  CC       libgnulib_a-creat-safer.o
  CC       libgnulib_a-open-safer.o
  CC       libgnulib_a-fd-hook.o
  CC       libgnulib_a-fflush.o
  CC       libgnulib_a-file-set.o
  CC       libgnulib_a-filemode.o
  CC       libgnulib_a-filenamecat-lgpl.o
  CC       libgnulib_a-float.o
  CC       libgnulib_a-fopen-safer.o
  CC       libgnulib_a-fpurge.o
  CC       libgnulib_a-freadahead.o
  CC       libgnulib_a-freading.o
  CC       libgnulib_a-fseek.o
  CC       libgnulib_a-fseeko.o
  CC       libgnulib_a-fts.o
  CC       libgnulib_a-getprogname.o
  CC       libgnulib_a-gettime.o
  CC       malloc/libgnulib_a-dynarray_at_failure.o
  CC       malloc/libgnulib_a-dynarray_emplace_enlarge.o
  CC       malloc/libgnulib_a-dynarray_finalize.o
  CC       malloc/libgnulib_a-dynarray_resize.o
  CC       malloc/libgnulib_a-dynarray_resize_clear.o
  CC       malloc/libgnulib_a-scratch_buffer_grow.o
  CC       malloc/libgnulib_a-scratch_buffer_grow_preserve.o
  CC       malloc/libgnulib_a-scratch_buffer_set_array_size.o
  CC       libgnulib_a-hard-locale.o
  CC       libgnulib_a-hash.o
  CC       libgnulib_a-hash-pjw.o
  CC       libgnulib_a-hash-triple-simple.o
  CC       libgnulib_a-human.o
  CC       libgnulib_a-i-ring.o
  CC       libgnulib_a-ialloc.o
  CC       libgnulib_a-idcache.o
  CC       libgnulib_a-localcharset.o
  CC       glthread/libgnulib_a-lock.o
  CC       libgnulib_a-malloca.o
  CC       libgnulib_a-math.o
  CC       libgnulib_a-mbchar.o
  CC       libgnulib_a-mbrtoc32.o
  CC       libgnulib_a-mbrtowc.o
  CC       libgnulib_a-mbscasestr.o
  CC       libgnulib_a-mbslen.o
  CC       libgnulib_a-mbsrtoc32s.o
  CC       libgnulib_a-mbsrtowcs.o
  CC       libgnulib_a-mbsstr.o
  CC       libgnulib_a-mbswidth.o
  CC       libgnulib_a-mbszero.o
  CC       libgnulib_a-mbuiter.o
  CC       libgnulib_a-mbuiterf.o
  CC       libgnulib_a-modechange.o
  CC       libgnulib_a-mountlist.o
  CC       libgnulib_a-nstrftime.o
  CC       glthread/libgnulib_a-once.o
  CC       libgnulib_a-openat-die.o
  CC       libgnulib_a-openat-safer.o
  CC       libgnulib_a-opendirat.o
  CC       libgnulib_a-parse-datetime.o
  CC       libgnulib_a-progname.o
  CC       libgnulib_a-quotearg.o
  CC       libgnulib_a-realloc.o
  CC       libgnulib_a-reallocarray.o
  CC       libgnulib_a-safe-read.o
  CC       libgnulib_a-same-inode.o
  CC       libgnulib_a-save-cwd.o
  CC       libgnulib_a-savedir.o
  CC       libgnulib_a-selinux-at.o
  CC       libgnulib_a-se-context.o
  CC       libgnulib_a-se-label.o
  CC       libgnulib_a-se-selinux.o
  CC       libgnulib_a-setlocale_null.o
  CC       libgnulib_a-setlocale_null-unlocked.o
  CC       libgnulib_a-sockets.o
  CC       libgnulib_a-stat-time.o
  CC       libgnulib_a-stdlib.o
  CC       libgnulib_a-strnlen1.o
  CC       libgnulib_a-sys_socket.o
  CC       glthread/libgnulib_a-threadlib.o
  CC       libgnulib_a-time_rz.o
  CC       libgnulib_a-timespec.o
  CC       unicase/libgnulib_a-tolower.o
  CC       unictype/libgnulib_a-ctype_alnum.o
  CC       unictype/libgnulib_a-ctype_alpha.o
  CC       unictype/libgnulib_a-ctype_blank.o
  CC       unictype/libgnulib_a-ctype_cntrl.o
  CC       unictype/libgnulib_a-ctype_digit.o
  CC       unictype/libgnulib_a-ctype_graph.o
  CC       unictype/libgnulib_a-ctype_lower.o
  CC       unictype/libgnulib_a-ctype_print.o
  CC       unictype/libgnulib_a-ctype_punct.o
  CC       unictype/libgnulib_a-ctype_space.o
  CC       unictype/libgnulib_a-ctype_upper.o
  CC       unictype/libgnulib_a-ctype_xdigit.o
  CC       libgnulib_a-unistd.o
  CC       libgnulib_a-dup-safer.o
  CC       libgnulib_a-fd-safer.o
  CC       libgnulib_a-pipe-safer.o
  CC       unistr/libgnulib_a-u32-chr.o
  CC       unistr/libgnulib_a-u32-cpy.o
  CC       unistr/libgnulib_a-u32-pcpy.o
  CC       unistr/libgnulib_a-u32-strcat.o
  CC       unistr/libgnulib_a-u32-strlen.o
  CC       uniwidth/libgnulib_a-width.o
  CC       libgnulib_a-version-etc.o
  CC       libgnulib_a-version-etc-fsf.o
  CC       libgnulib_a-wctype-h.o
  CC       libgnulib_a-vsnzprintf.o
  CC       libgnulib_a-xmalloc.o
  CC       libgnulib_a-xalloc-die.o
  CC       libgnulib_a-xgetcwd.o
  CC       libgnulib_a-xsize.o
  CC       libgnulib_a-xstrtod.o
  CC       libgnulib_a-xstrtol.o
  CC       libgnulib_a-xstrtoul.o
  CC       libgnulib_a-xstrtol-error.o
  CC       libgnulib_a-xstrtoumax.o
  CC       libgnulib_a-yesno.o
  CC       fopen.o
  CC       asnprintf.o
  CC       mbsrtoc32s-state.o
  CC       mbsrtowcs-state.o
  CC       mktime.o
  CC       printf-args.o
  CC       printf-parse.o
  CC       strerror_r.o
  CC       vasnprintf.o
  AR       libgnulib.a
make[5]: Leaving directory '/home/tavianator/code/gnu/findutils/gl/lib'
make[4]: Leaving directory '/home/tavianator/code/gnu/findutils/gl/lib'
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/gl/lib'
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/gl'
make[3]: Nothing to be done for 'all-am'.
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/gl'
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/gl'
Making all in build-aux
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/build-aux'
make[2]: Nothing to be done for 'all'.
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/build-aux'
Making all in lib
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/lib'
  CC       buildcmd.o
  CC       dircallback.o
  CC       extendbuf.o
  CC       fdleak.o
  CC       listfile.o
  CC       findutils-version.o
  CC       printquoted.o
  CC       qmark.o
  CC       safe-atoi.o
  CC       splitstring.o
  CC       regextype.o
  CC       bugreports.o
  AR       libfind.a
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/lib'
Making all in find
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/find'
Making all in .
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/find'
  CC       ftsfind.o
  CC       finddata.o
  CC       fstype.o
  CC       parser.o
  CC       pred.o
  CC       exec.o
  CC       tree.o
  CC       util.o
  CC       sharefile.o
  CC       print.o
  CC       getlimits.o
  AR       libfindtools.a
  CCLD     find
  CCLD     getlimits
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/find'
Making all in testsuite
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/find/testsuite'
make[3]: Nothing to be done for 'all'.
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/find/testsuite'
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/find'
Making all in xargs
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/xargs'
Making all in .
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/xargs'
  CC       xargs.o
  CCLD     xargs
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/xargs'
Making all in testsuite
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/xargs/testsuite'
make[3]: Nothing to be done for 'all'.
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/xargs/testsuite'
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/xargs'
Making all in locate
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/locate'
echo '@set LOCATE_DB /usr/local/var/locatedb' > dblocation.texi.tmp
if test -f dblocation.texi &amp;&amp; cmp dblocation.texi.tmp dblocation.texi >/dev/null ; then \
    rm dblocation.texi.tmp ; \
else \
    mv dblocation.texi.tmp dblocation.texi ; \
fi
make  all-recursive
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/locate'
Making all in .
make[4]: Entering directory '/home/tavianator/code/gnu/findutils/locate'
rm -f updatedb
  CC       locate.o
  CC       frcode.o
find=`echo find|sed 's,x,x,'`; \
frcode=`echo frcode|sed 's,x,x,'`; \
copyright=`sed -n '/^# Copyright /{s/^..//;p;q;}' ./updatedb.sh \
  grep .` || exit 1; \
sed \
-e "s,@""bindir""@,/usr/local/bin," \
-e "s,@""libexecdir""@,/usr/local/libexec," \
-e "s,@""LOCATE_DB""@,/usr/local/var/locatedb," \
-e "s,@""VERSION""@,4.10.0.51-1ef8-dirty," \
-e "s,@""PACKAGE_NAME""@,GNU findutils," \
-e "s,@""PACKAGE_BUGREPORT""@,bug-findutils@gnu.org," \
-e "s,@""PACKAGE_BUGREPORT_URL""@,https://savannah.gnu.org/bugs/?group=findutils," \
-e "s,@""PACKAGE_URL""@,https://www.gnu.org/software/findutils/," \
-e "s,@""find""@,${find}," \
-e "s,@""frcode""@,${frcode}," \
-e "s,@""SORT""@,/usr/bin/sort," \
-e "s,@""SORT_SUPPORTS_Z""@,true," \
-e "s/@""COPYRIGHT""@/${copyright}/" \
./updatedb.sh > updatedb
  CC       word_io.o
chmod +x updatedb
  CCLD     frcode
  CCLD     locate
make[4]: Leaving directory '/home/tavianator/code/gnu/findutils/locate'
Making all in testsuite
make[4]: Entering directory '/home/tavianator/code/gnu/findutils/locate/testsuite'
make[4]: Nothing to be done for 'all'.
make[4]: Leaving directory '/home/tavianator/code/gnu/findutils/locate/testsuite'
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/locate'
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/locate'
Making all in doc
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/doc'
ln -s ../locate/dblocation.texi dblocation.texi
make  all-am
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/doc'
make[3]: Nothing to be done for 'all-am'.
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/doc'
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/doc'
Making all in po
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/po'
make[2]: Nothing to be done for 'all'.
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/po'
Making all in m4
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/m4'
make[2]: Nothing to be done for 'all'.
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/m4'
Making all in gnulib-tests
make[2]: Entering directory '/home/tavianator/code/gnu/findutils/gnulib-tests'
  GEN      arpa/inet.h
  GEN      sys/ioctl.h
  GEN      signal.h
## ---------------------------------------------------- ##
  GEN      sys/select.h
  GEN      sys/random.h
## ------------------- Gnulib tests ------------------- ##
## You can ignore compiler warnings in this directory.  ##
## ---------------------------------------------------- ##
make  all-recursive
make[3]: Entering directory '/home/tavianator/code/gnu/findutils/gnulib-tests'
Making all in .
make[4]: Entering directory '/home/tavianator/code/gnu/findutils/gnulib-tests'
  CC       locale.o
  CC       arpa_inet.o
  CC       c32tob.o
  CC       binary-io.o
  CC       concat-filename.o
  CC       dtotimespec.o
  CC       fd-safer-flag.o
  CC       imaxtostr.o
  CC       dup-safer-flag.o
  CC       inttostr.o
  CC       offtostr.o
  CC       umaxtostr.o
  CC       uinttostr.o
  CC       ioctl.o
  CC       localename.o
  CC       localename-unsafe.o
  CC       localename-table.o
  CC       nanosleep.o
  CC       priv-set.o
  CC       pthread-rwlock.o
  CC       tempname.o
  CC       glthread/thread.o
  CC       time.o
  CC       timespec-add.o
  CC       timespec-sub.o
  CC       tmpdir.o
  CC       unistr/u32-set.o
  CC       unlinkdir.o
  CC       xconcat-filename.o
  CC       test-localcharset.o
  AR       libtests.a
  CCLD     current-locale
  CCLD     test-localcharset
make[4]: Leaving directory '/home/tavianator/code/gnu/findutils/gnulib-tests'
make[3]: Leaving directory '/home/tavianator/code/gnu/findutils/gnulib-tests'
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils/gnulib-tests'
make[2]: Entering directory '/home/tavianator/code/gnu/findutils'
make[2]: Leaving directory '/home/tavianator/code/gnu/findutils'
make[1]: Leaving directory '/home/tavianator/code/gnu/findutils'
</div></div>make -j48  12.05s user 4.70s system 593% cpu 2.822 total
</code></pre>

I paid [good money](https://en.wikipedia.org/wiki/Threadripper#Castle_Peak_(Threadripper_3000_series,_Zen_2_based)) for my 24 CPU cores, but `./configure` can only manage to use 69% of one of them.
As a result, this random project takes about 13.5&times; longer to *configure* the build than it does to actually *do* the build.

The purpose of a `./configure` script is basically to run the compiler a bunch of times and check which runs succeeded.
In this way it can test whether particular headers, functions, struct fields, etc. exist, which lets people write portable software.
This is an [embarrassingly parallel](https://en.wikipedia.org/wiki/Embarrassingly_parallel) problem, but [Autoconf can't parallelize it](https://lists.gnu.org/archive/html/autoconf/2021-01/msg00112.html), and [neither can CMake](https://stackoverflow.com/a/75161236/502399), [neither can Meson](https://github.com/mesonbuild/meson/issues/3635), etc., etc.

The problem is that most build configuration scripts pretty much look like this:

```sh
CFLAGS="-g"
if $CC $CFLAGS -Wall empty.c; then
    CFLAGS="$CFLAGS -Wall"
fi
...

: >config.h
if $CC $CFLAGS have_statx.c; then
    echo "#define HAVE_STATX 1" >>config.h
else
    echo "#define HAVE_STATX 0" >>config.h
fi
...
```

This is written in an inherently sequential way, but in principle many of these tests could be run in parallel.
In fact, we already have an effective tool for parallelizing lots of commands (`make`), so let's use it.
We'll have a configuration makefile that generates our `Makefile` and `config.h`:

<style>
.named-code {
    margin: 16px 0;
}
.named-code h4 {
    padding: 0 1rem;
    margin: 0;
    line-height: 2;
    background-color: var(--quote-bg);
}
.named-code pre {
    margin: 0;
}
</style>
<div class="named-code">

#### `configure.mk`

```mk
# The default goal generates both outputs, and merges the logs together
config: Makefile config.h
	cat Makefile.log config.h.log >$@.log
	rm Makefile.log config.h.log
```

</div>

---

To start with, we'll save the initial values of variables like `CC` and `CFLAGS` into the `Makefile`:

<div class="named-code">

#### `configure.mk`

```mk
# Default values, if unspecified
CC ?= cc
CPPFLAGS ?= -D_GNU_SOURCE
CFLAGS ?= -g
LDFLAGS ?=

# Export these through the environment to avoid stripping backslashes
export _CC=${CC}
export _CPPFLAGS=${CPPFLAGS}
export _CFLAGS=${CFLAGS}
export _LDFLAGS=${LDFLAGS}

Makefile:
	printf 'CC := %s\n' "$$_CC" >$@
	printf 'CPPFLAGS := %s\n' "$$_CPPFLAGS" >>$@
	printf 'CFLAGS := %s\n' "$$_CFLAGS" >>$@
	printf 'LDFLAGS := %s\n' "$$_LDFLAGS" >>$@
```

</div>

Using `export` like this avoids stripping the necessary backslashes from invocations like

```console
$ ./configure CPPFLAGS='-DMACRO=\"string\"'
```

---

Now let's check which flags our compiler supports.
We'll use this helper script:

<div class="named-code">

#### `flags.sh`

```sh
#!/bin/sh

set -eu

VAR="$1"
FLAGS="$2"
shift 2

if "$@" $FLAGS; then
    printf '%s += %s\n' "$VAR" "$FLAGS"
fi
```

</div>

When we run

```
$ ./flags.sh CFLAGS -Wall cc empty.c
```

it will print

```
CFLAGS += -Wall
```

if `cc empty.c -Wall` succeeds (and nothing otherwise).
We can use this to generate some makefile fragments that enable only the supported flags.

<div class="named-code">

#### `configure.mk`

```mk
ALL_FLAGS = ${CPPFLAGS} ${CFLAGS} ${LDFLAGS}

# Run the compiler with the given flags, sending
#
# - stdout to foo.mk (e.g. CFLAGS += -flag)
# - stderr to foo.mk.log (e.g. error: unrecognized command-line option ‘-flag’)
# - the compiled binary to foo.mk.out
#   - but then we delete it immediately
TRY_CC = ${CC} ${ALL_FLAGS} empty.c -o $@.out >$@ 2>$@.log && rm -f $@.out $@.d

deps.mk:
	./flags.sh CPPFLAGS "-MP -MD" ${TRY_CC}
Wall.mk:
	./flags.sh CFLAGS -Wall ${TRY_CC}
pthread.mk:
	./flags.sh CFLAGS -pthread ${TRY_CC}
bind-now.mk:
	./flags.sh LDFLAGS -Wl,-z,now ${TRY_CC}
```

</div>

Each of these targets generates a tiny makefile fragment that's responsible for a single flag.
Importantly, each one can run independently, in parallel.
Once they're done, we can merge them all into the main `Makefile` and clean up the cruft:

<div class="named-code">

#### `configure.mk`

```mk
FLAGS := \
    deps.mk \
    Wall.mk \
    pthread.mk \
    bind-now.mk

Makefile: ${FLAGS}
	printf 'CC := %s\n' "$$_CC" >$@
	...
	cat ${FLAGS} >>$@
	cat ${FLAGS:%=%.log} >$@.log
	rm ${FLAGS} ${FLAGS:%=%.log}
```

</div>

The last part to add to the `Makefile` is the part that actually builds our application.
We can write a simple makefile like this:

<div class="named-code">

#### `main.mk`

```mk
OBJS := main.o

app: ${OBJS}
	${CC} ${CFLAGS} ${LDFLAGS} ${OBJS} -o $@

${OBJS}:
	${CC} ${CPPFLAGS} ${CFLAGS} -c ${@:.o=.c} -o $@

-include ${OBJS:.o=.d}
```

</div>

And append it to the `Makefile` after all the flags:

<div class="named-code">

#### `configure.mk`

```mk
Makefile: ${FLAGS}
	...
	cat main.mk >>$@
```

</div>

---

We also want to generate a `config.h` file, which defines macros that tell us whether certain libraries/headers/functions/struct fields/etc. exist.
We can do this by test-compiling some simple C programs.
As an example, these programs check for the various ways to learn about a file's *creation timestamp*:

<div class="tabs">
<input type="radio" id="tabs-have-statx" name="tabs-have" checked>
<label for="tabs-have-statx"><code>have_statx.c</code></label>
<input type="radio" id="tabs-have-st-birthtim" name="tabs-have">
<label for="tabs-have-st-birthtim"><code>have_st_birthtim.c</code></label>
<input type="radio" id="tabs-have-st-birthtimespec" name="tabs-have">
<label for="tabs-have-st-birthtimespec"><code>have_st_birthtimespec.c</code></label>
<input type="radio" id="tabs-have---st-birthtim" name="tabs-have">
<label for="tabs-have---st-birthtim"><code>have___st_birthtim.c</code></label>

<div class="tab">

```c
#include <fcntl.h>
#include <sys/stat.h>

int main(void) {
	struct statx stx;
	return statx(AT_FDCWD, ".", 0, STATX_BTIME, &stx);
}
```

</div>
<div class="tab">

```c
#include <sys/stat.h>

int main(void) {
	struct stat sb = {0};
	return sb.st_birthtim.tv_sec;
}
```

</div>
<div class="tab">

```c
#include <sys/stat.h>

int main(void) {
	struct stat sb = {0};
	return sb.st_birthtimespec.tv_sec;
}
```

</div>
<div class="tab">

```c
#include <sys/stat.h>

int main(void) {
	struct stat sb = {0};
	return sb.__st_birthtim.tv_sec;
}
```

</div>
</div>
This helper script:

<div class="named-code">

#### `define.sh`

```sh
#!/bin/sh

set -eu

MACRO=$1
shift

if "$@"; then
    printf '#define %s 1\n' "$MACRO"
else
    printf '#define %s 0\n' "$MACRO"
fi
```

</div>

will output things like

```
#define HAVE_STATX 1
```

or

```
#define HAVE_ST_BIRTHTIM 0
```

depending on whether the build succeeds.
We can use it in a makefile like this:

<div class="named-code">

#### `configure.mk`

```mk
# Use a recursive make to pick up our auto-detected *FLAGS from above
config.h: Makefile
	+${MAKE} -f header.mk $@
```

#### `header.mk`

```mk
# Get the final *FLAGS values from the Makefile
include Makefile

# We first generate a lot of small headers, before merging them into one big one
HEADERS := \
    have_statx.h \
    have_st_birthtim.h \
    have_st_birthtimespec.h \
    have___st_birthtim.h

# Strip .h and capitalize the macro name
MACRO = $$(printf '%s' ${@:.h=} | tr 'a-z' 'A-Z')

ALL_FLAGS = ${CPPFLAGS} ${CFLAGS} ${LDFLAGS}

${HEADERS}:
	./define.sh ${MACRO} ${CC} ${ALL_FLAGS} ${@:.h=.c} -o $@.out >$@ 2>$@.log
	rm -f $@.out $@.d
```

</div>

And to join them all together (along with a header guard):

<div class="named-code">

#### `header.mk`

```mk
config.h: ${HEADERS}
	printf '#ifndef CONFIG_H\n' >$@
	printf '#define CONFIG_H\n' >>$@
	cat ${HEADERS} >>$@
	printf '#endif\n' >>$@
	cat ${HEADERS:%=%.log} >$@.log
	rm ${HEADERS} ${HEADERS:%=%.log}
```

</div>

---

The last step is to wrap `configure.mk` in a shell script, so people can run `./configure` like they're used to:

<div class="named-code">

#### `configure`

```sh
#!/bin/sh

set -eu

# Guess a good number for make -j<N>
jobs() {
    {
        nproc \
            || sysctl -n hw.ncpu \
            || getconf _NPROCESSORS_ONLN \
            || echo 1
    } 2>/dev/null
}

# Default to MAKE=make
MAKE="${MAKE-make}"

# Set MAKEFLAGS to -j$(jobs) if it's unset
export MAKEFLAGS="${MAKEFLAGS--j$(jobs)}"

$MAKE -r -f configure.mk "$@"
```

</div>

I put together a simple proof-of-concept [*fa-github* GitHub repository](https://github.com/tavianator/parconf) that contains the full version of all these files if you want to copy-paste.
The demo app prints file creation times, if it can figure out how to on your platform.

I've also been using a similar build system in [bfs](/projects/bfs.md) for a while, if you want to see a larger example.
The performance benefit is substantial:

<style>
pre code .scroll .bfs-config {
    animation: scroll 0.401s steps(73, jump-none) forwards;
}
pre code .scroll .bfs-make {
    animation: scroll 0.310s steps(30, jump-none) 0.401s forwards;
}
</style>
<pre>
<code>$ time ./configure
<div class="scroll"><div class="bfs-config">[ GEN] gen/vars.mk
[ CC ] build/empty.c                   ✔
[ CC ] flags/Wundef-prefix.c           ✘
[ CC ] flags/Wshadow.c                 ✔
[ CC ] flags/Wimplicit.c               ✔
[ CC ] flags/Wsign-compare.c           ✔
[ CC ] flags/Wmissing-var-decls.c      ✔
[ CC ] flags/Wimplicit-fallthrough.c   ✔
[ CC ] flags/Wmissing-decls.c          ✔
[ CC ] flags/Wformat.c                 ✔
[ CC ] flags/Wstrict-prototypes.c      ✔
[ CC ] flags/deps.c                    ✔
[ CC ] flags/pthread.c                 ✔
[ CC ] flags/bind-now.c                ✔
[ GEN] gen/flags.mk
[ CC ] with/libacl.c                   ✔
[ CC ] with/libcap.c                   ✔
[ CC ] with/oniguruma.c                ✔
[ CC ] with/liburing.c                 ✔
[ CC ] with/libselinux.c               ✘
[ GEN] gen/pkgs.mk
[ CC ] has/--st-birthtim.c             ✘
[ CC ] has/acl-is-trivial-np.c         ✘
[ CC ] has/builtin-riscv-pause.c       ✘
[ CC ] has/extattr-get-file.c          ✘
[ CC ] has/extattr-get-link.c          ✘
[ CC ] has/acl-trivial.c               ✘
[ CC ] has/getdents.c                  ✘
[ CC ] has/extattr-list-file.c         ✘
[ CC ] has/fdclosedir.c                ✘
[ CC ] has/extattr-list-link.c         ✘
[ CC ] has/getmntent-2.c               ✘
[ CC ] has/posix-getdents.c            ✘
[ CC ] has/getprogname.c               ✘
[ CC ] has/getmntinfo.c                ✘
[ CC ] has/string-to-flags.c           ✘
[ CC ] has/pragma-nounroll.c           ✘
[ CC ] has/st-birthtimespec.c          ✘
[ CC ] has/st-acmtimespec.c            ✘
[ CC ] has/pthread-set-name-np.c       ✘
[ CC ] has/st-birthtim.c               ✘
[ CC ] has/posix-spawn-addfchdir.c     ✘
[ CC ] has/tcgetwinsize.c              ✘
[ CC ] has/strerror-r-posix.c          ✘
[ CC ] has/st-flags.c                  ✘
[ CC ] has/strtofflags.c               ✘
[ CC ] has/tcsetwinsize.c              ✘
[ CC ] has/acl-get-file.c              ✔
[ CC ] has/_Fork.c                     ✔
[ CC ] has/confstr.c                   ✔
[ CC ] has/dprintf.c                   ✔
[ CC ] has/acl-get-entry.c             ✔
[ CC ] has/acl-get-tag-type.c          ✔
[ CC ] has/getdents64.c                ✔
[ CC ] has/getprogname-gnu.c           ✔
[ CC ] has/getdents64-syscall.c        ✔
[ CC ] has/getmntent-1.c               ✔
[ CC ] has/pipe2.c                     ✔
[ CC ] has/st-acmtim.c                 ✔
[ CC ] has/sched-getaffinity.c         ✔
[ CC ] has/strerror-r-gnu.c            ✔
[ CC ] has/posix-spawn-addfchdir-np.c  ✔
[ CC ] has/pthread-setname-np.c        ✔
[ CC ] has/strerror-l.c                ✔
[ CC ] has/timegm.c                    ✔
[ CC ] has/timer-create.c              ✔
[ CC ] has/statx-syscall.c             ✔
[ CC ] has/statx.c                     ✔
[ CC ] has/tm-gmtoff.c                 ✔
[ CC ] has/uselocale.c                 ✔
[ CC ] has/io-uring-max-workers.c      ✔
[ GEN] gen/config.h
[ GEN] gen/config.mk
</div></div>./configure  1.44s user 1.78s system 802% cpu 0.401 total
tavianator@tachyon $ time make -j48
<div class="scroll"><div class="bfs-make">[ CC ] src/main.c
[ CC ] src/xspawn.c
[ CC ] src/xtime.c
[ CC ] src/xregex.c
[ CC ] src/bar.c
[ CC ] src/bfstd.c
[ CC ] src/bftw.c
[ CC ] src/alloc.c
[ CC ] src/color.c
[ CC ] src/ctx.c
[ CC ] src/diag.c
[ CC ] src/dir.c
[ CC ] src/dstring.c
[ CC ] src/eval.c
[ CC ] src/exec.c
[ CC ] src/ioq.c
[ CC ] src/fsade.c
[ CC ] src/expr.c
[ CC ] src/mtab.c
[ CC ] src/opt.c
[ CC ] src/parse.c
[ CC ] src/printf.c
[ CC ] src/pwcache.c
[ CC ] src/sighook.c
[ CC ] src/thread.c
[ CC ] src/stat.c
[ CC ] src/trie.c
[ CC ] src/typo.c
[ CC ] src/version.c
[ LD ] bin/bfs
</div></div>make -j48  1.89s user 0.64s system 817% cpu 0.310 total
</code></pre>

Of course, a lot of the benefit comes from just doing less configuration steps, but the 802% CPU use is a tremendous improvement over everything else I've tried.
