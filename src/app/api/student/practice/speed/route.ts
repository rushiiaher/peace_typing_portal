import { NextRequest, NextResponse } from 'next/server';
import { getAdmin, getStudentInfo, PRACTICE_TYPE, insertSession, normaliseHistory } from '../_helpers';

// ── Builtin Marathi speed passages ─────────────────────────────────────────────
// Krutidev 010 encoded — always available even if DB has no content
const BUILTIN_MARATHI_PASSAGES = [
    {
        id: 'builtin-mr-speed-1',
        title: 'महाराष्ट्र राज्य - परिचय (Maharashtra State Introduction)',
        difficulty_level: 'beginner',
        word_count: 80,
        passage_text: `महाराष्ट्र हे भारताच्या पश्चिम भागात वसलेले एक महत्त्वाचे राज्य आहे. या राज्याची राजधानी मुंबई आहे. मुंबई ही भारताची आर्थिक राजधानी म्हणून ओळखली जाते. महाराष्ट्रात अनेक ऐतिहासिक किल्ले आणि मंदिरे आहेत. शिवाजी महाराज हे महाराष्ट्राचे महान राजे होते. त्यांनी मराठा साम्राज्याची स्थापना केली. महाराष्ट्राची संस्कृती आणि परंपरा खूप समृद्ध आहे.`,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-mr-speed-2',
        title: 'संगणक तंत्रज्ञान (Computer Technology)',
        difficulty_level: 'intermediate',
        word_count: 90,
        passage_text: `संगणक हे आधुनिक युगातील एक महत्त्वाचे साधन आहे. आज प्रत्येक क्षेत्रात संगणकाचा वापर होतो. शाळा, कार्यालये, रुग्णालये आणि बँका यांमध्ये संगणक वापरले जातात. इंटरनेटमुळे जगभरातील माहिती एका क्षणात मिळते. डिजिटल तंत्रज्ञानाने आपले जीवन सोपे केले आहे. मोबाइल फोन आणि संगणक यांच्यामुळे व्यवहार जलद होतात. माहिती तंत्रज्ञानाचे क्षेत्र खूप वेगाने विकसित होत आहे.`,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-mr-speed-3',
        title: 'शेती आणि शेतकरी (Agriculture and Farmers)',
        difficulty_level: 'intermediate',
        word_count: 95,
        passage_text: `भारत हा कृषिप्रधान देश आहे. येथील बहुतेक लोक शेती करतात. शेतकरी रात्रंदिवस मेहनत करून आपल्याला अन्नधान्य पुरवतात. महाराष्ट्रात प्रामुख्याने ज्वारी, बाजरी, गहू, तांदूळ आणि कापूस ही पिके घेतली जातात. सिंचन सुविधांमुळे शेती अधिक उत्पादनक्षम झाली आहे. आधुनिक यंत्रसामग्रीच्या वापरामुळे शेतीचे काम सोपे झाले आहे. शेतकऱ्यांना योग्य भाव मिळावा यासाठी सरकार प्रयत्नशील आहे.`,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-mr-speed-4',
        title: 'शिक्षणाचे महत्त्व (Importance of Education)',
        difficulty_level: 'advanced',
        word_count: 100,
        passage_text: `शिक्षण हे प्रत्येक माणसाच्या जीवनातील सर्वात महत्त्वाचे साधन आहे. चांगले शिक्षण घेतल्यामुळे माणूस आपल्या जीवनात यशस्वी होतो. शिक्षणामुळे माणसाला योग्य-अयोग्य यातील फरक कळतो. शाळेत मिळालेले ज्ञान आयुष्यभर उपयोगी पडते. विज्ञान आणि गणित या विषयांमुळे तर्कशक्ती विकसित होते. भाषा शिकल्यामुळे इतरांशी संवाद साधणे सोपे जाते. डिजिटल साक्षरतेमुळे आजच्या काळात नोकरी मिळणे सोपे होते. म्हणूनच प्रत्येकाने शिक्षण घेणे आवश्यक आहे.`,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
];

// ── Builtin English speed passages ────────────────────────────────────────────
const BUILTIN_ENGLISH_PASSAGES = [
    {
        id: 'builtin-en-speed-1',
        title: 'The Importance of Time Management',
        difficulty_level: 'beginner',
        word_count: 75,
        passage_text: `Time management is one of the most important skills in life. People who manage their time well are more productive and less stressed. They are able to complete their work on time and still have time for hobbies and family. Good time management starts with setting clear goals and priorities. Making a daily schedule helps you stay organized. Avoid wasting time on unimportant activities. Remember that time once lost can never be recovered.`,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
    {
        id: 'builtin-en-speed-2',
        title: 'Benefits of Regular Exercise',
        difficulty_level: 'intermediate',
        word_count: 85,
        passage_text: `Regular exercise is essential for maintaining good health. It helps keep the body fit and strong. Exercise improves blood circulation and strengthens the heart and lungs. People who exercise regularly have better immunity and are less likely to fall sick. It also helps reduce stress and anxiety. A thirty-minute walk every day can make a big difference to your health. Swimming, cycling, and yoga are also excellent forms of exercise. Children should play outdoor games to stay active and healthy.`,
        is_active: true,
        best_accuracy: null, best_wpm: null, attempted: false,
    },
];

export async function GET(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!student.course_id) return NextResponse.json({ passages: [] });

        const admin = getAdmin();
        const { data: passages, error } = await admin
            .from('speed_passages')
            .select('id, title, difficulty_level, passage_text, word_count, is_active, created_at')
            .eq('course_id', student.course_id)
            .eq('is_active', true)
            .order('created_at', { ascending: true });
        if (error) throw error;

        const { data: historyRaw } = await admin
            .from('practice_sessions')
            .select('content_id, wpm, accuracy, completed_at')
            .eq('student_id', student.student_id)
            .eq('practice_type', PRACTICE_TYPE.speed)
            .order('completed_at', { ascending: false });

        const history = normaliseHistory(historyRaw ?? []);
        const best: Record<string, { accuracy: number; wpm: number }> = {};
        for (const h of history) {
            if (!best[h.content_id] || h.wpm > best[h.content_id].wpm)
                best[h.content_id] = { accuracy: h.accuracy, wpm: h.wpm };
        }

        const dbPassages = (passages ?? []).map((p: any) => ({
            ...p,
            best_accuracy: best[p.id]?.accuracy ?? null,
            best_wpm: best[p.id]?.wpm ?? null,
            attempted: !!best[p.id],
        }));

        // Add builtins based on course language
        const builtins = student.is_marathi ? BUILTIN_MARATHI_PASSAGES : BUILTIN_ENGLISH_PASSAGES;
        const builtinsWithHistory = builtins.map(p => ({
            ...p,
            best_accuracy: best[p.id]?.accuracy ?? null,
            best_wpm: best[p.id]?.wpm ?? null,
            attempted: !!best[p.id],
        }));

        return NextResponse.json({
            passages: [...dbPassages, ...builtinsWithHistory],
            is_marathi: student.is_marathi,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const student = await getStudentInfo();
        if (!student) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { passage_id, wpm, accuracy, mistakes, duration_seconds } = await req.json();
        const admin = getAdmin();
        const { data, error } = await insertSession(admin, {
            student_id: student.student_id,
            institute_id: student.institute_id,
            practice_type: PRACTICE_TYPE.speed,
            content_id: passage_id,
            wpm, accuracy, mistakes, duration_seconds,
        });
        if (error) throw error;
        return NextResponse.json({ session: data }, { status: 201 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
